// Discord Rich Presence (IPC local con el cliente de escritorio de Discord).
const { Client } = require('@xhayper/discord-rpc');

const LISTENING = 2; // ActivityType.Listening
const STATUS_DISPLAY_DETAILS = 2;

const pad = (t, limit = 128) => {
  let s = String(t || '').trim() || '♪';
  if (s.length < 2) s += ' ♪';
  return s.length > limit ? s.slice(0, limit - 1) + '…' : s;
};

class Presence {
  constructor() {
    this.client = null;
    this.appId = null;
    this.ready = false;
    this.onState = () => {};
  }

  async connect(appId) {
    if (this.client && this.appId === appId && this.ready) return;
    await this.disconnect();
    this.appId = appId;
    const client = new Client({ clientId: appId });
    client.on('ready', () => {
      this.ready = true;
      this.onState(true);
    });
    client.on('disconnected', () => {
      this.ready = false;
      this.onState(false);
    });
    this.client = client;
    await client.login();
    this.ready = true;
    this.onState(true);
  }

  async update({ line, title, artist, cover, useCover }) {
    if (!this.client || !this.ready) return;
    const activity = {
      type: LISTENING,
      statusDisplayType: STATUS_DISPLAY_DETAILS,
      details: pad(line),
      state: pad(`${title} — ${artist}`),
      instance: false,
    };
    if (useCover && cover) {
      activity.largeImageKey = cover;
      activity.largeImageText = pad(title);
    }
    await this.client.user?.setActivity(activity);
  }

  async clear() {
    try {
      await this.client?.user?.clearActivity();
    } catch (_) {
      /* ignorar */
    }
  }

  async disconnect() {
    if (!this.client) return;
    try {
      await this.client.user?.clearActivity();
      await this.client.destroy();
    } catch (_) {
      /* ignorar */
    }
    this.client = null;
    this.ready = false;
    this.onState(false);
  }
}

module.exports = { Presence };
