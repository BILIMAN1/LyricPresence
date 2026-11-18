// Parser de letras sincronizadas (formato LRC) / Synced lyrics (LRC) parser.

const LINE = /^\s*((?:\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/;
const STAMP = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g;

/** Devuelve [{ time (ms), text }] ordenado por tiempo. */
function parseLrc(lrc) {
  const out = [];
  for (const raw of String(lrc || '').split(/\r?\n/)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const text = m[2].trim();
    let s;
    STAMP.lastIndex = 0;
    while ((s = STAMP.exec(m[1])) !== null) {
      const sec = parseFloat(s[2].replace(':', '.'));
      out.push({ time: Math.round((parseInt(s[1], 10) * 60 + sec) * 1000), text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Índice de la línea activa en la posición `posMs` (-1 si aún no empieza). */
function findLineIndex(lines, posMs) {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= posMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

module.exports = { parseLrc, findLineIndex };
