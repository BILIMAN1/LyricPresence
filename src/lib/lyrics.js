// Búsqueda de letras sincronizadas en LRCLIB (https://lrclib.net), gratis y sin cuenta.
const { parseLrc } = require('./lrc');

const BASE = 'https://lrclib.net/api';
const HEADERS = { 'User-Agent': 'LyricPresence/1.0 (https://github.com/TU_USUARIO/lyricpresence)' };

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json();
}

/** @returns {Promise<{time:number,text:string}[]>} lista vacía si no hay letra sincronizada */
async function fetchLyrics({ title, artist, album, durationMs }) {
  const duration = Math.round(durationMs / 1000);
  try {
    const q = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      album_name: album || '',
      duration: String(duration),
    });
    const exact = await getJson(`${BASE}/get?${q}`);
    if (exact && exact.syncedLyrics) return parseLrc(exact.syncedLyrics);

    const s = new URLSearchParams({ track_name: title, artist_name: artist });
    const results = (await getJson(`${BASE}/search?${s}`)) || [];
    const best = results.find(
      (r) => r.syncedLyrics && Math.abs((r.duration || 0) - duration) <= 5
    );
    return best ? parseLrc(best.syncedLyrics) : [];
  } catch (err) {
    console.error('[lyrics]', err.message);
    return [];
  }
}

module.exports = { fetchLyrics };
