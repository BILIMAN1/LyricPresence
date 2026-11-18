// Aviso de nueva versión: consulta la última release publicada en GitHub. No descarga ni instala nada;
// solo avisa y abre la página de la release para que la persona descargue el .exe nuevo.

/** "v1.10.0" > "1.9.3" -> true. Ignora sufijos tipo "-beta". */
function isNewer(latest, current) {
  const parse = (v) =>
    String(v || '')
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * @param {string} repo "usuario/repositorio"
 * @param {string} current versión instalada
 * @param {typeof fetch} [fetchImpl] se puede inyectar para pruebas
 * @returns {Promise<{version:string,url:string}|null>} null si estás al día o no se pudo comprobar
 */
async function checkForUpdate(repo, current, fetchImpl = fetch) {
  if (!repo) return null;
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LyricPresence-update-check' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const rel = await res.json();
    if (!rel || rel.draft || rel.prerelease || !rel.tag_name) return null;
    if (!isNewer(rel.tag_name, current)) return null;
    // Solo abrimos páginas de GitHub, nunca una URL arbitraria que venga en la respuesta.
    const url = /^https:\/\/github\.com\//.test(rel.html_url || '')
      ? rel.html_url
      : `https://github.com/${repo}/releases/latest`;
    return { version: String(rel.tag_name).replace(/^v/i, ''), url };
  } catch {
    return null;
  }
}

module.exports = { isNewer, checkForUpdate };
