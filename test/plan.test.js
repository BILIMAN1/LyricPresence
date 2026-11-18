// Simula una canción y mide cuánto del tiempo la línea que suena está escrita en la tarjeta de Discord,
// respetando el límite de 5 actualizaciones cada 20 s.
const assert = require('assert');
const { Planner, MIN_GAP_MS, LEAD_MS, buildActivity } = require('../src/lib/discordPlan');
const { findLineIndex } = require('../src/lib/lrc');

const track = { title: 'Canción', artist: 'Artista' };

function makeLines(count, gapFn) {
  const lines = [];
  let t = 8000;
  for (let i = 0; i < count; i++) {
    lines.push({ time: t, text: `línea número ${i}` });
    t += gapFn(i);
  }
  return lines;
}

function simulate({ mode, lines, tickMs = 250, latencyMs = 300, failEvery = 0 }) {
  const planner = new Planner();
  const end = lines[lines.length - 1].time + 3000;
  const sends = [];
  const pending = []; // envíos que Discord aún está "pintando"
  let card = null; // { details, state }
  let covered = 0;
  let total = 0;
  let sendCount = 0;

  for (let t = 0; t < end; t += tickMs) {
    while (pending.length && pending[0].at <= t) card = pending.shift();

    const idxD = findLineIndex(lines, t + LEAD_MS);
    const act = planner.next({ now: t, mode, lines, idx: idxD, track });
    if (act) {
      sendCount++;
      if (failEvery && sendCount % failEvery === 0) planner.failed(t);
      else {
        sends.push(t);
        pending.push({ at: t + latencyMs, details: act.details, state: act.state });
      }
    }

    const real = findLineIndex(lines, t);
    if (real >= 0) {
      total++;
      const text = lines[real].text;
      if (card && (card.details === text || card.state === text)) covered++;
    }
  }

  let worst = 0;
  for (let i = 0; i < sends.length; i++) {
    const inWindow = sends.filter((s) => s > sends[i] - 20000 && s <= sends[i]).length;
    worst = Math.max(worst, inWindow);
  }
  return { coverage: covered / total, worst, sends: sends.length };
}

// 1) Letra normal (una línea cada ~2.3 s)
const normal = makeLines(80, () => 2300);
const pair = simulate({ mode: 'pair', lines: normal });
const song = simulate({ mode: 'song', lines: normal });
console.log('pair  (2.3 s/línea):', (pair.coverage * 100).toFixed(1) + '%', 'máx/20s:', pair.worst);
console.log('song  (2.3 s/línea):', (song.coverage * 100).toFixed(1) + '%', 'máx/20s:', song.worst);
assert(pair.coverage >= 0.97, 'pair debería cubrir >= 97 % del tiempo');
assert(pair.coverage > song.coverage + 0.3, 'pair debe mejorar claramente a song');
assert(pair.worst <= 5 && song.worst <= 5, 'nunca más de 5 envíos en 20 s');

// 2) Líneas irregulares (1.6 s a 4.5 s)
const irregular = makeLines(80, (i) => 1600 + ((i * 937) % 2900));
const irr = simulate({ mode: 'pair', lines: irregular });
console.log('pair  (irregular):  ', (irr.coverage * 100).toFixed(1) + '%', 'máx/20s:', irr.worst);
assert(irr.coverage >= 0.85);
assert(irr.worst <= 5);

// 3) Caso extremo: Discord rechaza 1 de cada 3 envíos. Lo que importa: no se pasa del límite y se sigue recuperando
const flaky = simulate({ mode: 'pair', lines: normal, failEvery: 3 });
console.log('pair  (Discord falla 1 de 3):', (flaky.coverage * 100).toFixed(1) + '%', 'máx/20s:', flaky.worst);
assert(flaky.worst <= 5);
assert(flaky.coverage >= 0.4);

// 4) Contenido de la tarjeta
const L = [
  { time: 1000, text: 'primera' },
  { time: 3000, text: '' },
  { time: 5000, text: 'última' },
];
let a = buildActivity({ mode: 'pair', lines: L, idx: 0, track });
assert.strictEqual(a.details, 'primera');
assert.strictEqual(a.state, 'Canción — Artista', 'si la siguiente está vacía, muestra la canción');
a = buildActivity({ mode: 'pair', lines: L, idx: -1, track });
assert.strictEqual(a.details, '♪');
assert.strictEqual(a.state, 'primera');
a = buildActivity({ mode: 'pair', lines: L, idx: 1, track });
assert.strictEqual(a.details, '♪', 'línea vacía = nota musical');
assert.strictEqual(a.state, 'última');
a = buildActivity({ mode: 'song', lines: L, idx: 2, track });
assert.strictEqual(a.details, 'última');
assert.strictEqual(a.state, 'Canción — Artista');
a = buildActivity({ mode: 'pair', lines: [], idx: -2, track });
assert.strictEqual(a.details, 'Canción');
assert.strictEqual(a.state, 'Artista');
assert.strictEqual(a.key, 'meta');

// 5) Sin letra: se manda una sola vez
const p = new Planner();
assert(p.next({ now: 0, mode: 'pair', lines: [], idx: -2, track }));
assert.strictEqual(p.next({ now: 10000, mode: 'pair', lines: [], idx: -2, track }), null);

// 6) Respeta el hueco mínimo
const q = new Planner();
assert(q.next({ now: 1000, mode: 'pair', lines: normal, idx: 0, track }));
assert.strictEqual(q.next({ now: 1000 + MIN_GAP_MS - 1, mode: 'pair', lines: normal, idx: 2, track }), null);
assert(q.next({ now: 1000 + MIN_GAP_MS, mode: 'pair', lines: normal, idx: 2, track }));

// 7) Si la línea actual ya está en la tarjeta (arriba o abajo), no se gasta un envío
const r = new Planner();
assert(r.next({ now: 0, mode: 'pair', lines: normal, idx: 5, track }));
assert.strictEqual(r.next({ now: 9000, mode: 'pair', lines: normal, idx: 5, track }), null);
assert.strictEqual(r.next({ now: 9000, mode: 'pair', lines: normal, idx: 6, track }), null, 'idx+1 ya se ve abajo');
assert(r.next({ now: 9000, mode: 'pair', lines: normal, idx: 7, track }), 'idx+2 ya no se ve');
assert(new Planner().next({ now: 0, mode: 'pair', lines: normal, idx: 4, track }));
const back = new Planner();
back.next({ now: 0, mode: 'pair', lines: normal, idx: 10, track });
assert(back.next({ now: 9000, mode: 'pair', lines: normal, idx: 3, track }), 'saltar atrás reenvía');

console.log('plan: OK');
