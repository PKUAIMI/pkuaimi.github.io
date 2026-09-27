import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { startPreviewServer } from '../src/preview-server.mjs';

const quiet = { log() {}, error() {} };

function fixture(t, value = { text: 'Initial page' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aimi-preview-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['content/templates', 'src', 'public', 'dist/news']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/item.json'), JSON.stringify(value));
  fs.writeFileSync(path.join(root, 'site.config.json'), '{}');
  return root;
}

function fixtureBuilder({ root }) {
  const item = JSON.parse(fs.readFileSync(path.join(root, 'content/item.json'), 'utf8'));
  if (item.text.includes('TODO')) throw new Error('请填写 TODO 草稿。');
  fs.writeFileSync(path.join(root, 'dist/index.html'), `<html><body><h1>${item.text}</h1></body></html>`);
  if (item.failAfterWrite) throw new Error('模拟输出更新过程中失败。');
  fs.writeFileSync(path.join(root, 'dist/news/index.html'), '<html><body>News page</body></html>');
  fs.writeFileSync(path.join(root, 'dist/404.html'), '<html><body>Missing page</body></html>');
  fs.writeFileSync(path.join(root, 'dist/styles.css'), 'body { color: black; }');
}

async function waitFor(predicate, message = 'preview did not update') {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

async function previewFixture(t, options = {}) {
  const root = fixture(t, options.value);
  const preview = await startPreviewServer({ root, port: 0, debounceMs: 35, build: fixtureBuilder, logger: quiet, ...options });
  t.after(() => preview.close());
  return { root, preview };
}

function rawRequest(url, pathname) {
  const address = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: address.hostname, port: address.port, path: pathname }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
  });
}

test('valid edits rebuild automatically and development scripts stay out of dist', async (t) => {
  const { root, preview } = await previewFixture(t);
  const initialRevision = preview.getState().revision;
  const first = await fetch(preview.url);
  assert.match(await first.text(), /Initial page/);
  fs.writeFileSync(path.join(root, 'content/item.json'), JSON.stringify({ text: 'Updated page' }));
  await waitFor(() => preview.getState().revision !== initialRevision);
  const updated = await fetch(preview.url);
  const body = await updated.text();
  assert.match(body, /Updated page/);
  assert.match(body, /__aimi_preview__\/client\.js/);
  assert.match(updated.headers.get('cache-control'), /no-cache/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'), /__aimi_preview__/);
  const revision = await (await fetch(`${preview.url}/__aimi_preview__/revision`)).json();
  assert.equal(revision.revision, preview.getState().revision);
  const client = await (await fetch(`${preview.url}/__aimi_preview__/client.js`)).text();
  assert.match(client, /location\.reload\(\)/);
  assert.match(client, /预览更新失败/);
});

test('invalid JSON, TODO drafts and partial failed output preserve the last good page and recover', async (t) => {
  const { root, preview } = await previewFixture(t);
  const initialRevision = preview.getState().revision;
  fs.writeFileSync(path.join(root, 'content/item.json'), '{');
  await waitFor(() => preview.getState().error);
  assert.match(await (await fetch(preview.url)).text(), /Initial page/);
  assert.equal(preview.getState().revision, initialRevision);
  fs.writeFileSync(path.join(root, 'content/item.json'), JSON.stringify({ text: 'TODO' }));
  await waitFor(() => preview.getState().error?.includes('TODO'));
  assert.match(await (await fetch(preview.url)).text(), /Initial page/);
  fs.writeFileSync(path.join(root, 'content/item.json'), JSON.stringify({ text: 'Broken partial output', failAfterWrite: true }));
  await waitFor(() => preview.getState().error?.includes('模拟输出'));
  assert.match(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'), /Broken partial output/);
  assert.match(await (await fetch(preview.url)).text(), /Initial page/);
  fs.writeFileSync(path.join(root, 'content/item.json'), JSON.stringify({ text: 'Recovered page' }));
  await waitFor(() => preview.getState().revision !== initialRevision && !preview.getState().error);
  assert.match(await (await fetch(preview.url)).text(), /Recovered page/);
});

test('a failed first build serves a local 503 and recovers after the source is fixed', async (t) => {
  const { root, preview } = await previewFixture(t, { value: { text: 'TODO' } });
  const first = await fetch(preview.url);
  assert.equal(first.status, 503);
  assert.match(await first.text(), /暂时无法生成预览/);
  assert.equal(preview.getState().ready, false);
  fs.writeFileSync(path.join(root, 'content/item.json'), JSON.stringify({ text: 'First valid page' }));
  await waitFor(() => preview.getState().ready);
  assert.equal((await fetch(preview.url)).status, 200);
});

test('static responses preserve redirects, MIME types, HEAD and 404 behavior', async (t) => {
  const { preview } = await previewFixture(t);
  const redirect = await fetch(`${preview.url}/news?view=all`, { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), '/news/?view=all');
  assert.match(await (await fetch(`${preview.url}/news/`)).text(), /News page/);
  const missing = await fetch(`${preview.url}/missing/`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Missing page/);
  const css = await fetch(`${preview.url}/styles.css`, { method: 'HEAD' });
  assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal(await css.text(), '');
  assert.equal((await fetch(preview.url, { method: 'POST' })).status, 405);
});

test('traversal, malformed URLs and symlinks cannot read outside the preview snapshot', async (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'private.txt'), 'private repository secret');
  fs.symlinkSync(path.join(root, 'private.txt'), path.join(root, 'dist/leak.txt'));
  const preview = await startPreviewServer({ root, port: 0, debounceMs: 35, build: fixtureBuilder, logger: quiet });
  t.after(() => preview.close());
  for (const pathname of ['/../private.txt', '/%2e%2e/private.txt', '/..%2fprivate.txt', '/%5c..%5cprivate.txt']) {
    const response = await rawRequest(preview.url, pathname);
    assert.equal(response.status, 403);
    assert.doesNotMatch(response.body, /private repository secret/);
  }
  assert.equal((await rawRequest(preview.url, '/%E0%A4%A')).status, 400);
  const leak = await fetch(`${preview.url}/leak.txt`);
  assert.equal(leak.status, 404);
  assert.doesNotMatch(await leak.text(), /private repository secret/);
});

test('generated output and templates do not trigger rebuild loops; config edits do', async (t) => {
  let builds = 0;
  const { root, preview } = await previewFixture(t, { build: (options) => { builds += 1; fixtureBuilder(options); } });
  const initialBuilds = builds;
  fs.writeFileSync(path.join(root, 'index.html'), 'generated root file');
  fs.writeFileSync(path.join(root, 'dist/index.html'), 'generated dist file');
  fs.writeFileSync(path.join(root, 'content/templates/news.json'), '{}');
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.equal(builds, initialBuilds);
  fs.writeFileSync(path.join(root, 'site.config.json'), '{"name":"Changed"}');
  await waitFor(() => builds > initialBuilds);
  assert.match(await (await fetch(preview.url)).text(), /Initial page/);
});

test('fresh build workers reload edited source modules', async (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'src/label.mjs'), 'export const label = "First template";\n');
  fs.writeFileSync(path.join(root, 'src/build-site.mjs'), `import fs from 'node:fs';
import path from 'node:path';
import { label } from './label.mjs';
export function buildSite({ root }) {
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<html><body>' + label + '</body></html>');
}
`);
  const preview = await startPreviewServer({ root, port: 0, debounceMs: 35, logger: quiet });
  t.after(() => preview.close());
  assert.match(await (await fetch(preview.url)).text(), /First template/);
  const initialRevision = preview.getState().revision;
  fs.writeFileSync(path.join(root, 'src/label.mjs'), 'export const label = "Second template";\n');
  await waitFor(() => preview.getState().revision !== initialRevision);
  assert.match(await (await fetch(preview.url)).text(), /Second template/);
});
