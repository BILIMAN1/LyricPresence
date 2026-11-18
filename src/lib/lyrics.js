// Búsqueda de letras en LRCLIB (https://lrclib.net), gratis y sin cuenta.
const { parseLrc } = require('./lrc');

const BASE = 'https://lrclib.net/api';
const HEADERS = { 'User-Agent': 'LyricPresence/1.1 (https://github.com/BILIMAN1/LyricPresence)' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Reparte una letra sin tiempos de forma pareja a lo largo de la canción (letra "aproximada").
 * Se deja ~6 % al inicio y ~6 % al final, donde casi siempre hay intro y cierre instrumental.
 */
function spreadPlain(plain, durationMs) {
  const rows = String(plain || '')
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!rows.length || !durationMs) return [];
  const start = durationMs * 0.06;
  const span = durationMs * 0.88;
  return rows.map((text, i) => ({ time: Math.round(start + (span * i) / rows.length), text }));
}

/**
 * @param {{title:string,artist:string,album?:string,durationMs:number}} track
 * @param {{allowPlain?:boolean}} [opts] allowPlain: si no hay letra sincronizada, usa una aproximada
 * @returns {Promise<{lines:{time:number,text:string}[], kind:'synced'|'approx'|null}>}
 */
async function fetchLyrics({ title, artist, album, durationMs }, { allowPlain = false } = {}) {
  const duration = Math.round(durationMs / 1000);
  try {
    const q = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      album_name: album || '',
      duration: String(duration),
    });
    const exact = await getJson(`${BASE}/get?${q}`);
    if (exact && exact.syncedLyrics) return { lines: parseLrc(exact.syncedLyrics), kind: 'synced' };

    const s = new URLSearchParams({ track_name: title, artist_name: artist });
    const results = (await getJson(`${BASE}/search?${s}`)) || [];
    const close = (r) => Math.abs((r.duration || 0) - duration) <= 5;

    const synced = results.find((r) => r.syncedLyrics && close(r));
    if (synced) return { lines: parseLrc(synced.syncedLyrics), kind: 'synced' };

    if (allowPlain) {
      const plainSrc = (exact && exact.plainLyrics) || (results.find((r) => r.plainLyrics && close(r)) || {}).plainLyrics;
      const lines = spreadPlain(plainSrc, durationMs);
      if (lines.length) return { lines, kind: 'approx' };
    }
    return { lines: [], kind: null };
  } catch (err) {
    console.error('[lyrics]', err.message);
    return { lines: [], kind: null };
  }
}

module.exports = { fetchLyrics, spreadPlain };
