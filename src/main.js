const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const settingsStore = require('./lib/settings');
const { SpotifyClient, REDIRECT_URI } = require('./lib/spotify');
const { Presence } = require('./lib/presence');
const { Engine } = require('./lib/engine');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let settings;
let spotify;
let engine;

// Estado que ve la interfaz
const view = {
  running: false,
  spotify: false,
  discord: false,
  loggedIn: false,
  track: null,
  lyric: null,
  error: null,
  detail: null,
};

function push(patch) {
  Object.assign(view, patch);
  if (win && !win.isDestroyed()) win.webContents.send('state', view);
}

function persist() {
  settingsStore.save(settings);
}

function buildSpotify() {
  spotify = new SpotifyClient({
    clientId: settings.spotifyClientId,
    tokens: settingsStore.readTokens(settings),
    onTokens: (t) => {
      settingsStore.writeTokens(settings, t);
      persist();
    },
    openUrl: (u) => shell.openExternal(u),
  });
  push({ loggedIn: spotify.loggedIn });
}

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 700,
    minWidth: 400,
    minHeight: 620,
    backgroundColor: '#0e0e14',
    title: 'LyricPresence',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function publicSettings() {
  const { tokensEnc, ...rest } = settings;
  return {
    ...rest,
    redirectUri: REDIRECT_URI,
    locale: app.getLocale(),
    defaultDiscordAppId: settingsStore.DEFAULT_DISCORD_APP_ID,
  };
}

app.whenReady().then(() => {
  settings = settingsStore.load();
  buildSpotify();

  engine = new Engine({
    spotify: {
      get loggedIn() {
        return spotify.loggedIn;
      },
      getPlayback: () => spotify.getPlayback(),
    },
    presence: new Presence(),
    getSettings: () => settings,
  });
  engine.presence.onState = (ok) => push({ discord: ok });
  engine.on('status', push);

  ipcMain.handle('settings:get', () => publicSettings());

  ipcMain.handle('settings:save', (_e, patch) => {
    const allowed = ['spotifyClientId', 'discordAppId', 'offsetMs', 'useCover', 'language'];
    const idChanged = patch.spotifyClientId !== undefined && patch.spotifyClientId.trim() !== settings.spotifyClientId;
    for (const k of allowed) if (patch[k] !== undefined) settings[k] = patch[k];
    settings.spotifyClientId = String(settings.spotifyClientId || '').trim();
    settings.discordAppId = String(settings.discordAppId || '').trim();
    settings.offsetMs = Number(settings.offsetMs) || 0;
    if (idChanged) {
      settingsStore.writeTokens(settings, null);
      buildSpotify();
    }
    persist();
    return publicSettings();
  });

  ipcMain.handle('spotify:login', async () => {
    if (!settings.spotifyClientId) return { ok: false, error: 'MISSING_SPOTIFY_ID' };
    try {
      await spotify.login();
      push({ loggedIn: true, error: null });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'LOGIN_FAILED', detail: e.message };
    }
  });

  ipcMain.handle('spotify:logout', async () => {
    await engine.stop();
    spotify.logout();
    push({ loggedIn: false, spotify: false });
  });

  ipcMain.handle('engine:start', async () => {
    try {
      await engine.start();
      return { ok: true };
    } catch (e) {
      push({ error: e.message });
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('engine:stop', () => engine.stop());
  ipcMain.handle('state:get', () => view);
  ipcMain.handle('open:external', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });

  createWindow();

  // Si ya está todo configurado, empieza solo al abrir la app
  if (settings.autoStart && spotify.loggedIn && settings.spotifyClientId && settings.discordAppId) {
    engine.start().catch(() => {});
  }
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('before-quit', async () => {
  try {
    await engine?.stop();
  } catch (_) {
    /* ignorar */
  }
});

app.on('window-all-closed', () => app.quit());
