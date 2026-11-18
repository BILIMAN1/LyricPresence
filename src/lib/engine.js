// Motor: consulta Spotify, calcula la línea actual y la manda a Discord.
const { EventEmitter } = require('events');
const { fetchLyrics } = require('./lyrics');
const { findLineIndex } = require('./lrc');
const { Planner, LEAD_MS } = require('./discordPlan');

const POLL_MS = 4000; // consulta a Spotify
const TICK_MS = 200; // refresco de la UI y del planificador de Discord

class Engine extends EventEmitter {
  constructor({ spotify, presence, getSettings }) {
    super();
    this.spotify = spotify;
    this.presence = presence;
    this.getSettings = getSettings;
    this.running = false;
    this._reset();
  }

  _reset() {
    this.track = null; // último playback de Spotify
    this.trackId = null;
    this.lines = [];
    this.lyricsKind = null; // 'synced' | 'approx' | null
    this.lyricsLoading = false;
    this.planner = new Planner();
    this.baseProgress = 0;
    this.baseAt = 0;
    this.lastIdx = null;
    this.pollTimer = null;
    this.tickTimer = null;
    this.cleared = true;
    this.nextPollAt = 0;
  }

  _emit(patch) {
    this.emit('status', patch);
  }

  async start() {
    if (this.running) return;
    const s = this.getSettings();
    if (!s.spotifyClientId) throw new Error('MISSING_SPOTIFY_ID');
    if (!s.discordAppId) throw new Error('MISSING_DISCORD_ID');
    if (!this.spotify.loggedIn) throw new Error('NOT_LOGGED_IN');

    this.running = true;
    this._reset();
    this._emit({ running: true, error: null });

    this._connectDiscord();
    this._poll();
    this.tickTimer = setInterval(() => this._tick(), TICK_MS);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    clearTimeout(this.pollTimer);
    clearInterval(this.tickTimer);
    await this.presence.disconnect();
    this._reset();
    this._emit({ running: false, track: null, lyric: null, error: null });
  }

  async _connectDiscord() {
    const { discordAppId } = this.getSettings();
    try {
      await this.presence.connect(discordAppId);
      this._emit({ discord: true, error: null });
    } catch (e) {
      this._emit({ discord: false, error: 'DISCORD_UNAVAILABLE' });
      if (this.running) setTimeout(() => this.running && this._connectDiscord(), 8000);
    }
  }

  async _poll() {
    if (!this.running) return;
    let delay = POLL_MS;
    try {
      const pb = await this.spotify.getPlayback();
      this._emit({ spotify: true });
      await this._onPlayback(pb);
    } catch (e) {
      if (e.message === 'RATE_LIMIT') delay = (e.retryAfter || 5) * 1000;
      else if (e.message === 'NOT_LOGGED_IN') {
        this._emit({ spotify: false, error: 'NOT_LOGGED_IN' });
      } else if (e.message !== 'TOKEN_EXPIRED') {
        this._emit({ spotify: false, error: 'SPOTIFY_ERROR', detail: e.message });
      }
    }
    if (this.running) this.pollTimer = setTimeout(() => this._poll(), delay);
  }

  async _onPlayback(pb) {
    if (!pb) {
      this.track = null;
      this.trackId = null;
      this.lines = [];
      this.lyricsKind = null;
      this._emit({ track: null, lyric: null });
      await this._clearDiscord();
      return;
    }
    this.baseProgress = pb.progressMs;
    this.baseAt = Date.now();

    if (pb.id !== this.trackId) {
      this.trackId = pb.id;
      this.lines = [];
      this.lyricsKind = null;
      this.lyricsLoading = true;
      this.lastIdx = null;
      this.planner.reset();
      this.track = pb;
      this._emit({ track: this._publicTrack(pb), lyric: null });
      const { allowPlain } = this._lyricOpts();
      const res = await fetchLyrics(pb, { allowPlain });
      if (this.trackId === pb.id) {
        this.lines = res.lines;
        this.lyricsKind = res.kind;
        this.lyricsLoading = false;
        this.lastIdx = null;
        this._emit({ track: this._publicTrack(pb) });
      }
    }
    this.track = pb;
    this._emit({ track: this._publicTrack(pb) });
    if (!pb.isPlaying) await this._clearDiscord();
  }

  _lyricOpts() {
    return { allowPlain: !!this.getSettings().useApproxLyrics };
  }

  _publicTrack(pb) {
    return {
      title: pb.title,
      artist: pb.artist,
      album: pb.album,
      cover: pb.cover,
      isPlaying: pb.isPlaying,
      hasLyrics: this.lines.length > 0,
      lyricsKind: this.lyricsKind,
      loading: this.lyricsLoading,
      durationMs: pb.durationMs,
    };
  }

  async _clearDiscord() {
    if (this.cleared) return;
    this.cleared = true;
    this.planner.reset();
    await this.presence.clear();
  }

  _tick() {
    const tr = this.track;
    if (!this.running || !tr || !tr.isPlaying) return;
    const s = this.getSettings();
    const pos = this.baseProgress + (Date.now() - this.baseAt) + (s.offsetMs || 0);
    const hasLines = this.lines.length > 0;
    const idx = hasLines ? findLineIndex(this.lines, pos) : -2;

    if (idx !== this.lastIdx) {
      this.lastIdx = idx;
      const L = this.lines;
      this._emit({
        lyric: hasLines
          ? {
              prev: idx > 0 ? L[idx - 1].text : '',
              current: idx >= 0 ? L[idx].text || '♪' : '♪',
              next: L[idx + 1] ? L[idx + 1].text : '',
              approx: this.lyricsKind === 'approx',
            }
          : null,
      });
    }

    // Discord: esperamos a saber si hay letra y a que el cliente de Discord esté conectado.
    if (this.lyricsLoading || !this.presence.ready) return;
    const now = Date.now();
    const idxD = hasLines ? findLineIndex(this.lines, pos + LEAD_MS) : -2;
    const act = this.planner.next({
      now,
      mode: s.discordMode === 'song' ? 'song' : 'pair',
      lines: this.lines,
      idx: idxD,
      track: tr,
    });
    if (!act) return;
    this.cleared = false;
    this.presence
      .update({ ...act, cover: tr.cover, useCover: s.useCover })
      .then(() => {
        if (this._discordErr) {
          this._discordErr = false;
          this._emit({ error: null });
        }
      })
      .catch((e) => {
        this._discordErr = true;
        this.planner.failed(Date.now());
        this._emit({ error: 'DISCORD_ERROR', detail: e.message });
      });
  }
}

module.exports = { Engine };
