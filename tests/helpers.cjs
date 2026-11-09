const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
async function loadModule(file, globals = {}, mocks = {}) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, performance, AbortController, ...globals });
  const cache = new Map();
  async function get(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const mock = mocks[path.relative(root, filename)];
    let mod;
    if (mock) mod = new vm.SyntheticModule(Object.keys(mock), function () { for (const [key, value] of Object.entries(mock)) this.setExport(key, value); }, { context, identifier: filename });
    else mod = new vm.SourceTextModule(fs.readFileSync(filename, 'utf8'), { context, identifier: filename });
    cache.set(filename, mod);
    await mod.link((specifier, parent) => get(path.resolve(path.dirname(parent.identifier), specifier)));
    return mod;
  }
  const mod = await get(path.resolve(root, file));
  await mod.evaluate();
  return mod.namespace;
}
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: i => [...values.keys()][i], get length() { return values.size; } };
}
module.exports = { loadModule, storage, root };
