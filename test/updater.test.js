const assert = require('assert');
const { isNewer, checkForUpdate } = require('../src/lib/updater');

assert(isNewer('v1.1.0', '1.0.0'));
assert(isNewer('1.10.0', '1.9.3'));
assert(isNewer('2.0', '1.9.9'));
assert(!isNewer('1.0.0', '1.0.0'));
assert(!isNewer('v1.0.0', '1.0.1'));
assert(!isNewer('1.1.0-beta', '1.1.0'));
assert(!isNewer('', '1.0.0'));

const reply = (body, ok = true) => async () => ({ ok, json: async () => body });

(async () => {
  const up = await checkForUpdate('a/b', '1.0.0', reply({ tag_name: 'v1.2.0', html_url: 'https://github.com/a/b/releases/tag/v1.2.0' }));
  assert.deepStrictEqual(up, { version: '1.2.0', url: 'https://github.com/a/b/releases/tag/v1.2.0' });

  assert.strictEqual(await checkForUpdate('a/b', '1.2.0', reply({ tag_name: 'v1.2.0', html_url: 'https://github.com/a/b' })), null);
  assert.strictEqual(await checkForUpdate('a/b', '1.0.0', reply({ tag_name: 'v9.0.0', prerelease: true })), null);
  assert.strictEqual(await checkForUpdate('a/b', '1.0.0', reply({}, false)), null);
  assert.strictEqual(await checkForUpdate('a/b', '1.0.0', async () => { throw new Error('offline'); }), null);
  assert.strictEqual(await checkForUpdate('', '1.0.0', reply({})), null);

  // Una URL que no sea de GitHub se reemplaza por la página oficial de releases
  const safe = await checkForUpdate('a/b', '1.0.0', reply({ tag_name: 'v2.0.0', html_url: 'https://evil.example/x' }));
  assert.strictEqual(safe.url, 'https://github.com/a/b/releases/latest');

  console.log('updater: OK');
})();
