// Spotify: login con PKCE (solo necesitas el Client ID, sin Client Secret) y lectura de reproducción.
const http = require('http');
const crypto = require('crypto');

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-read-currently-playing';

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class SpotifyClient {
  /**
   * @param {{clientId:string, tokens:object|null, onTokens:(t:object|null)=>void, openUrl:(u:string)=>void}} opts
   */
  constructor({ clientId, tokens, onTokens, openUrl }) {
    this.clientId = clientId;
    this.tokens = tokens; // { access_token, refresh_token, expires_at }
    this.onTokens = onTokens;
    this.openUrl = openUrl;
  }

  get loggedIn() {
    return !!(this.tokens && this.tokens.refresh_token);
  }

  /** Abre el navegador, espera la redirección y guarda los tokens. */
  login() {
    return new Promise((resolve, reject) => {
      const verifier = b64url(crypto.randomBytes(48));
      const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
      const state = b64url(crypto.randomBytes(12));

      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, REDIRECT_URI);
        if (url.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }
        const code = url.searchParams.get('code');
        const err = url.searchParams.get('error');
        const ok = code && !err && url.searchParams.get('state') === state;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<body style="font-family:sans-serif;background:#0f0f14;color:#fff;display:grid;place-items:center;height:100vh">` +
            `<h2>${ok ? '✅ Listo / Done — ya puedes cerrar esta pestaña / you can close this tab' : '❌ Error: ' + (err || 'invalid')}</h2></body>`
        );
        clearTimeout(timer);
        server.close();
        if (!ok) return reject(new Error(err || 'Spotify login failed'));
        try {
          await this._token({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      const timer = setTimeout(() => {
        server.close();
        reject(new Error('Login timeout'));
      }, 3 * 60 * 1000);

      server.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`No se pudo abrir el puerto ${PORT}: ${e.message}`));
      });

      server.listen(PORT, '127.0.0.1', () => {
        const q = new URLSearchParams({
          client_id: this.clientId,
          response_type: 'code',
          redirect_uri: REDIRECT_URI,
          scope: SCOPES,
          code_challenge_method: 'S256',
          code_challenge: challenge,
          state,
        });
        this.openUrl(`${AUTH_URL}?${q}`);
      });
    });
  }

  logout() {
    this.tokens = null;
    this.onTokens(null);
  }

  async _token(params) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, ...params }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
    this.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || (this.tokens && this.tokens.refresh_token),
      expires_at: Date.now() + (data.expires_in - 60) * 1000,
    };
    this.onTokens(this.tokens);
  }

  async _accessToken() {
    if (!this.loggedIn) throw new Error('NOT_LOGGED_IN');
    if (Date.now() >= this.tokens.expires_at) {
      await this._token({ grant_type: 'refresh_token', refresh_token: this.tokens.refresh_token });
    }
    return this.tokens.access_token;
  }

  /** @returns {Promise<null|{id,title,artist,album,durationMs,progressMs,isPlaying,cover}>} */
  async getPlayback() {
    const token = await this._accessToken();
    const res = await fetch(`${API}/me/player`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 204) return null;
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') || '5', 10);
      const e = new Error('RATE_LIMIT');
      e.retryAfter = wait;
      throw e;
    }
    if (res.status === 401) {
      this.tokens.expires_at = 0;
      throw new Error('TOKEN_EXPIRED');
    }
    if (!res.ok) throw new Error(`Spotify HTTP ${res.status}`);
    const d = await res.json();
    if (!d || !d.item || d.currently_playing_type !== 'track') return null;
    const it = d.item;
    return {
      id: it.id,
      title: it.name,
      artist: it.artists.map((a) => a.name).join(', '),
      firstArtist: it.artists[0].name,
      album: it.album.name,
      durationMs: it.duration_ms,
      progressMs: d.progress_ms || 0,
      isPlaying: !!d.is_playing,
      cover: (it.album.images[1] || it.album.images[0] || {}).url || null,
    };
  }
}

module.exports = { SpotifyClient, REDIRECT_URI };
