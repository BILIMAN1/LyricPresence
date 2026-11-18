// Planificador de lo que se manda a Discord. Es lógica pura (sin Electron ni red) para poder probarla.
//
// Discord acepta ~5 actualizaciones de actividad cada 20 s, y una línea de letra dura ~2-3 s.
// Mandar "solo la línea actual" siempre se queda corto: la tarjeta va atrasada y se saltan líneas.
// Estrategia "pair": cada envío lleva la línea actual (arriba) Y la siguiente (abajo). Así, entre un
// envío y el siguiente, la línea que suena casi siempre ya está escrita en la tarjeta.
//
// Solo se envía cuando la línea que suena YA NO está en la tarjeta (ni arriba ni abajo). Así cada envío
// cae justo al empezar una línea y dura lo máximo posible (~2 líneas) sin gastar el límite de Discord.

const MIN_GAP_MS = 4200; // 5 envíos / 20 s = 4000 ms; dejamos margen
const LEAD_MS = 500; // adelanto: la tarjeta de Discord tarda en pintarse
const ERROR_HOLD_MS = 6000; // si Discord rechaza un envío, esperamos antes de reintentar

const clean = (t) => (t && String(t).trim()) || '♪';

function meta(track) {
  return `${track.title} — ${track.artist}`;
}

/**
 * Qué mostrar para una posición dada.
 * @param {{mode:'pair'|'song', lines:{time:number,text:string}[], idx:number, track:{title:string,artist:string}}} p
 * @returns {{key:string|number, details:string, state:string, largeText:string}}
 */
function buildActivity({ mode, lines, idx, track }) {
  const largeText = meta(track);
  if (!lines || !lines.length) {
    // Sin letra: mostramos la canción para que el perfil no se quede vacío.
    return { key: 'meta', details: clean(track.title), state: clean(track.artist), largeText };
  }
  const current = idx >= 0 ? clean(lines[idx].text) : '♪';
  if (mode === 'song') {
    return { key: idx, details: current, state: meta(track), largeText };
  }
  const nextLine = lines[idx + 1];
  const state = nextLine && nextLine.text && nextLine.text.trim() ? nextLine.text.trim() : meta(track);
  return { key: idx, details: current, state, largeText };
}

class Planner {
  constructor({ minGap = MIN_GAP_MS } = {}) {
    this.minGap = minGap;
    this.reset();
  }

  reset() {
    this.sentKey = undefined; // contenido que hay ahora en la tarjeta
    this.lastSentAt = 0;
    this.holdUntil = 0;
    this._prev = null;
  }

  /**
   * Devuelve la actividad a enviar ahora, o null si hay que esperar / no hay cambios.
   * Si devuelve algo, el envío queda registrado; si Discord falla, llama a failed().
   */
  next({ now, mode, lines, idx, track }) {
    if (now < this.holdUntil) return null;
    if (this.lastSentAt && now - this.lastSentAt < this.minGap) return null;
    const act = buildActivity({ mode, lines, idx, track });
    if (act.key === this.sentKey) return null;
    if (typeof act.key === 'number' && typeof this.sentKey === 'number') {
      // ¿la línea actual ya se ve en la tarjeta? (en "pair" también como línea de abajo)
      const reach = mode === 'song' ? 0 : 1;
      if (idx >= this.sentKey && idx <= this.sentKey + reach) return null;
    }
    this._prev = { sentKey: this.sentKey, lastSentAt: this.lastSentAt };
    this.sentKey = act.key;
    this.lastSentAt = now;
    return act;
  }

  /** El envío falló: deshacer el registro y esperar un poco antes de reintentar. */
  failed(now) {
    if (this._prev) {
      this.sentKey = this._prev.sentKey;
      this.lastSentAt = this._prev.lastSentAt;
      this._prev = null;
    }
    this.holdUntil = now + ERROR_HOLD_MS;
  }
}

module.exports = { Planner, buildActivity, MIN_GAP_MS, LEAD_MS, ERROR_HOLD_MS };
