import fs from 'node:fs';
import path from 'node:path';

/** Write declared artifacts; remove only files from the previous manifest. */
export function writeOutput(root, files) {
  const manifestPath = path.join(root, 'generated-files.json');
  const previous = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const safePath = name => typeof name === 'string' && !path.isAbsolute(name)
    && !name.split(/[\\/]/).some(part => part === '..' || part === '.') && name.length > 0;
  for (const name of files.keys()) {
    if (!safePath(name)) throw new Error(`Unsafe output path: ${name}`);
  }
  for (const old of previous) {
    if (files.has(old) || !safePath(old)) continue;
    for (const base of [root, path.join(root, 'dist')]) {
      const target = path.join(base, old);
      if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.unlinkSync(target);
    }
  }
  for (const [name, value] of files) {
    const formatted = typeof value === 'string' && name.endsWith('.html')
      ? value.replace(/[ \t]+$/gm, '') + '\n' : value;
    const data = Buffer.isBuffer(formatted) ? formatted : Buffer.from(formatted);
    for (const base of [root, path.join(root, 'dist')]) {
      const target = path.join(base, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(data)) fs.writeFileSync(target, data);
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify([...files.keys()].sort(), null, 2) + '\n');
}

export function collectPublicFiles(root, files) {
  const publicRoot = path.join(root, 'public');
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!entry.name.endsWith('.part') && entry.name !== '.DS_Store') {
        const name = path.relative(publicRoot, full).split(path.sep).join('/');
        if (files.has(name)) throw new Error(`public/${name} conflicts with a generated page.`);
        files.set(name, fs.readFileSync(full));
      }
    }
  }
  walk(publicRoot);
}
