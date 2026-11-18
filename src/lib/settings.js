// Ajustes guardados en la carpeta de datos del usuario. Los tokens se cifran con safeStorage.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

// ID de tu aplicación de Discord (es público, NO es un secreto). Créala en
// https://discord.com/developers/applications con el nombre que quieras que se vea
// ("Escuchando <nombre>") y pega aquí su Application ID para que los usuarios no tengan que hacerlo.
const DEFAULT_DISCORD_APP_ID = '';

const DEFAULTS = {
  spotifyClientId: '',
  discordAppId: DEFAULT_DISCORD_APP_ID,
  offsetMs: 300,
  useCover: true,
  language: 'auto',
  autoStart: true,
  tokensEnc: null,
};

const file = () => path.join(app.getPath('userData'), 'settings.json');

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
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
