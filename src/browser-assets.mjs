import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/** Bundle locally: the published homepage never depends on a third-party CDN. */
export async function buildBrowserAssets() {
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL('../', import.meta.url)),
    publicDir: false,
    logLevel: 'error',
    build: {
      write: false,
      target: 'es2020',
      minify: true,
      sourcemap: false,
      lib: {
        entry: fileURLToPath(new URL('./browser/home-scroll.ts', import.meta.url)),
        formats: ['es'],
        fileName: 'home-scroll',
        cssFileName: 'home-scroll',
      },
    },
  });
  const files = new Map();
  for (const output of (Array.isArray(result) ? result : [result])) {
    for (const file of output.output) {
      files.set(`assets/scroll/${file.fileName}`, file.type === 'chunk' ? file.code : file.source);
    }
  }
  return files;
}
