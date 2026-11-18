const { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, globalShortcut, Notification } = require('electron');
const path = require('path');
const settingsStore = require('./lib/settings');
const { SpotifyClient, REDIRECT_URI } = require('./lib/spotify');
const { Presence } = require('./lib/presence');
const { Engine } = require('./lib/engine');
const { checkForUpdate } = require('./lib/updater');
const { DEFAULT_DISCORD_APP_ID, GITHUB_REPO } = require('./config');

if (!app.requestSingleInstanceLock()) app.quit();

const ICON = path.join(__dirname, '..', 'build', 'icon.png');
const LAUNCHED_HIDDEN = process.argv.includes('--hidden'); // lo pone el inicio con Windows
const OFFSET_STEP = 100;
const OFFSET_MAX = 3000;
const UPDATE_EVERY_MS = 12 * 60 * 60 * 1000;

let win;
let tray = null;
let settings;
let spotify;
let engine;
let isQuitting = false;

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
  offsetMs: 0,
  update: null, // { version, url } cuando hay una versión nueva
};

// Textos de la bandeja y avisos (la interfaz tiene los suyos en renderer/i18n.js)
const T = {
  es: {
    open: 'Abrir LyricPresence',
    start: 'Iniciar sincronización',
    stop: 'Detener sincronización',
    update: (v) => `Descargar versión ${v}…`,
    quit: 'Salir',
    idle: 'detenido',
    sync: (ms) => `Sincronía: ${ms > 0 ? '+' : ''}${ms} ms`,
    hiddenNote: 'LyricPresence sigue en segundo plano (icono junto al reloj).',
  },
  en: {
    open: 'Open LyricPresence',
    start: 'Start syncing',
    stop: 'Stop syncing',
    update: (v) => `Download version ${v}…`,
    quit: 'Quit',
    idle: 'stopped',
    sync: (ms) => `Sync offset: ${ms > 0 ? '+' : ''}${ms} ms`,
    hiddenNote: 'LyricPresence keeps running in the background (icon near the clock).',
  },
};

function lang() {
  const l = settings && settings.language !== 'auto' ? settings.language : app.getLocale();
  return String(l).toLowerCase().startsWith('es') ? 'es' : 'en';
}
const t = () => T[lang()];

let trayKey = '';
function push(patch) {
  Object.assign(view, patch);
  if (win && !win.isDestroyed()) win.webContents.send('state', view);
  // La bandeja solo se reconstruye si cambió algo que muestra (no en cada línea de letra).
  const key = [view.running, view.loggedIn, view.track && view.track.title, view.update && view.update.version].join('|');
  if (key !== trayKey) {
    trayKey = key;
    refreshTray();
  }
}

function persist() {
  settingsStore.save(settings);
}

// ───────── Spotify ─────────
function buildSpotify() {
  spotify = new SpotifyClient({
    clientId: settings.spotifyClientId,
    tokens: settingsStore.readTokens(settings),
    onTokens: (tk) => {
      settingsStore.writeTokens(settings, tk);
      persist();
    },
    openUrl: (u) => shell.openExternal(u),
  });
  push({ loggedIn: spotify.loggedIn });
}

// ───────── Ventana ─────────
function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 400,
    minHeight: 640,
    show: !LAUNCHED_HIDDEN,
    backgroundColor: '#0e0e14',
    title: 'LyricPresence',
    icon: ICON,
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

  // Cerrar la ventana no cierra la app: se queda en la bandeja (salvo que lo desactives).
  win.on('close', (e) => {
    if (!isQuitting && tray && settings.minimizeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ───────── Bandeja ─────────
function trayTooltip() {
  const base = 'LyricPresence';
  const tr = view.track;
  if (!view.running) return `${base} · ${t().idle}`;
  const song = tr ? ` · ${tr.title} — ${tr.artist}` : '';
  return `${base}${song}`.slice(0, 120);
}

function refreshTray() {
  if (!tray) return;
  const tx = t();
  const items = [
    { label: tx.open, click: showWindow },
    {
      label: view.running ? tx.stop : tx.start,
      enabled: view.loggedIn || view.running,
      click: () => (view.running ? engine.stop() : startEngine()),
    },
  ];
  if (view.update) {
    items.push({ type: 'separator' }, { label: tx.update(view.update.version), click: () => shell.openExternal(view.update.url) });
  }
  items.push({ type: 'separator' }, { label: tx.quit, click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(trayTooltip());
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(ICON);
    if (img.isEmpty()) return;
    tray = new Tray(img.resize({ width: 16, height: 16 }));
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
    refreshTray();
  } catch (e) {
    console.error('[tray]', e.message);
    tray = null; // sin bandeja, cerrar la ventana cierra la app
  }
}

// ───────── Inicio con Windows ─────────
function applyLoginItem() {
  if (!app.isPackaged || (process.platform !== 'win32' && process.platform !== 'darwin')) return;
  try {
    app.setLoginItemSettings({
      openAtLogin: !!settings.startWithWindows,
      // En la versión portable, process.execPath apunta a una carpeta temporal; esta variable apunta al .exe real.
      path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
      args: ['--hidden'],
    });
  } catch (e) {
    console.error('[login-item]', e.message);
  }
}

// ───────── Calibración de desfase ─────────
function setOffset(ms) {
  settings.offsetMs = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Math.round(ms)));
  persist();
  push({ offsetMs: settings.offsetMs });
  return settings.offsetMs;
}

function nudgeOffset(delta) {
  const ms = setOffset((settings.offsetMs || 0) + delta);
  // Si la ventana no se ve, avisamos con una notificación discreta para saber que el atajo funcionó.
  if (!win || !win.isVisible() || !win.isFocused()) {
    tray?.setToolTip(`LyricPresence · ${t().sync(ms)}`);
    if (Notification.isSupported()) new Notification({ title: 'LyricPresence', body: t().sync(ms), silent: true }).show();
  }
  return ms;
}

function registerShortcuts() {
  const ok1 = globalShortcut.register('CommandOrControl+Alt+Right', () => nudgeOffset(OFFSET_STEP));
  const ok2 = globalShortcut.register('CommandOrControl+Alt+Left', () => nudgeOffset(-OFFSET_STEP));
  if (!ok1 || !ok2) console.warn('[shortcuts] otro programa ya usa Ctrl+Alt+←/→');
}

// ───────── Actualizaciones ─────────
async function runUpdateCheck() {
  if (!settings.checkUpdates) return;
  const up = await checkForUpdate(GITHUB_REPO, app.getVersion());
  if (up && (!view.update || view.update.version !== up.version)) push({ update: up });
}

// ───────── Motor ─────────
async function startEngine() {
  try {
    await engine.start();
    return { ok: true };
  } catch (e) {
    push({ error: e.message });
    return { ok: false, error: e.message };
  }
}

function publicSettings() {
  const { tokensEnc, ...rest } = settings;
  return {
    ...rest,
    redirectUri: REDIRECT_URI,
    locale: app.getLocale(),
    defaultDiscordAppId: DEFAULT_DISCORD_APP_ID,
    appVersion: app.getVersion(),
    githubRepo: GITHUB_REPO,
    canAutostart: app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin'),
  };
}

const BOOLS = ['useCover', 'useApproxLyrics', 'startWithWindows', 'minimizeToTray', 'checkUpdates', 'autoStart'];

app.whenReady().then(() => {
  settings = settingsStore.load();
  view.offsetMs = settings.offsetMs;
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
    const textKeys = ['spotifyClientId', 'discordAppId', 'language'];
    const idChanged = patch.spotifyClientId !== undefined && String(patch.spotifyClientId).trim() !== settings.spotifyClientId;
    for (const k of textKeys) if (patch[k] !== undefined) settings[k] = String(patch[k]);
    for (const k of BOOLS) if (patch[k] !== undefined) settings[k] = !!patch[k];
    if (patch.discordMode !== undefined) settings.discordMode = patch.discordMode === 'song' ? 'song' : 'pair';
    if (patch.offsetMs !== undefined) settings.offsetMs = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Math.round(Number(patch.offsetMs) || 0)));
    settings.spotifyClientId = settings.spotifyClientId.trim();
    settings.discordAppId = settings.discordAppId.trim();
    if (idChanged) {
      settingsStore.writeTokens(settings, null);
      buildSpotify();
    }
    persist();
    applyLoginItem();
    view.offsetMs = settings.offsetMs;
    push({});
    if (settings.checkUpdates) runUpdateCheck();
    else push({ update: null });
    return publicSettings();
  });

  ipcMain.handle('offset:nudge', (_e, delta) => nudgeOffset(Math.max(-1000, Math.min(1000, Number(delta) || 0))));
  ipcMain.handle('offset:set', (_e, ms) => setOffset(Number(ms) || 0));

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

  ipcMain.handle('engine:start', () => startEngine());
  ipcMain.handle('engine:stop', () => engine.stop());
  ipcMain.handle('state:get', () => view);
  ipcMain.handle('open:external', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });

  createWindow();
  createTray();
  registerShortcuts();
  applyLoginItem();

  // Si ya está todo configurado, empieza solo al abrir la app
  if (settings.autoStart && spotify.loggedIn && settings.spotifyClientId && settings.discordAppId) {
    engine.start().catch(() => {});
  }

  if (LAUNCHED_HIDDEN && Notification.isSupported() && tray) {
    // Un solo aviso discreto para que se sepa dónde quedó la app tras iniciar Windows.
    new Notification({ title: 'LyricPresence', body: t().hiddenNote, silent: true }).show();
  }

  setTimeout(runUpdateCheck, 5000);
  setInterval(runUpdateCheck, UPDATE_EVERY_MS);
});

app.on('second-instance', () => {
  if (app.isReady()) showWindow();
});

// Al salir de verdad: limpiar la actividad de Discord antes de cerrar (con tope de tiempo).
let cleaned = false;
app.on('before-quit', (e) => {
  isQuitting = true;
  if (cleaned) return;
  cleaned = true;
  e.preventDefault();
  const stop = engine ? engine.stop().catch(() => {}) : Promise.resolve();
  Promise.race([stop, new Promise((r) => setTimeout(r, 1500))]).finally(() => app.quit());
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// Con bandeja, cerrar la ventana no cierra la app. Sin bandeja, sí.
app.on('window-all-closed', () => {
  if (!tray || isQuitting) app.quit();
});
