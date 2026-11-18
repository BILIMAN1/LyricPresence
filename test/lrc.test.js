const assert = require('assert');
const { parseLrc, findLineIndex } = require('../src/lib/lrc');

const lines = parseLrc(`[ar:Test]
[00:12.50] Primera línea
[00:20.00]Segunda
[01:05.250]Tercera
[00:30.00][00:40.00]Coro
texto sin tiempo`);

assert.strictEqual(lines.length, 5);
assert.deepStrictEqual(lines[0], { time: 12500, text: 'Primera línea' });
assert.strictEqual(lines[4].time, 65250);
assert.strictEqual(lines.filter((l) => l.text === 'Coro').length, 2, 'varias marcas en una línea');

assert.strictEqual(findLineIndex(lines, 0), -1, 'antes de la primera línea');
assert.strictEqual(findLineIndex(lines, 12500), 0);
assert.strictEqual(findLineIndex(lines, 25000), 1);
assert.strictEqual(findLineIndex(lines, 30000), 2);
assert.strictEqual(findLineIndex(lines, 999999), 4, 'después de la última');
assert.strictEqual(findLineIndex([], 1000), -1, 'sin letra');

console.log('lrc: OK');
