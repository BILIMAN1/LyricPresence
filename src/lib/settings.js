// Ajustes guardados en la carpeta de datos del usuario. Los tokens se cifran con safeStorage.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const { DEFAULT_DISCORD_APP_ID } = require('../config');

const DEFAULTS = {
  spotifyClientId: '',
  discordAppId: DEFAULT_DISCORD_APP_ID,
  offsetMs: 300, // + adelanta la letra, - la retrasa
  useCover: true,
  language: 'auto',
  autoStart: true, // empezar a sincronizar al abrir la app
  discordMode: 'pair', // 'pair' = línea actual + siguiente | 'song' = línea + nombre de la canción
  useApproxLyrics: false, // si no hay letra sincronizada, usar una repartida de forma pareja
  startWithWindows: false,
  minimizeToTray: true,
  checkUpdates: true,
  tokensEnc: null,
};

const file = () => path.join(app.getPath('userData'), 'settings.json');

function load() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    /* primera vez o archivo dañado: usamos los valores por defecto */
  }
  const s = { ...DEFAULTS, ...saved };
  if (!s.discordAppId) s.discordAppId = DEFAULT_DISCORD_APP_ID;
  return s;
}

function save(settings) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(settings, null, 2));
}

function readTokens(settings) {
  if (!settings.tokensEnc) return null;
  try {
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(settings.tokensEnc, 'base64'))
      : Buffer.from(settings.tokensEnc, 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTokens(settings, tokens) {
  if (!tokens) {
    settings.tokensEnc = null;
    return;
  }
  const raw = JSON.stringify(tokens);
  settings.tokensEnc = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(raw).toString('base64')
    : Buffer.from(raw, 'utf8').toString('base64');
}

module.exports = { load, save, readTokens, writeTokens, DEFAULT_DISCORD_APP_ID };
