import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

const revisionPath = '/__aimi_preview__/revision';
const clientPath = '/__aimi_preview__/client.js';
const watchedDirectories = ['content', 'src', 'public'];
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
};
const cacheHeaders = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

const clientSource = `(() => {
  const initialRevision = document.currentScript.dataset.revision;
  let notice;
  function showError(message, ready) {
    if (!message) {
      if (notice) notice.remove();
      notice = undefined;
      return;
    }
    if (!notice) {
      notice = document.createElement('aside');
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.style.cssText = 'position:fixed;z-index:2147483647;bottom:16px;left:16px;right:16px;padding:16px 20px;border:1px solid #b42318;border-radius:8px;background:#fff7f6;color:#7a271a;font:14px/1.5 system-ui,sans-serif;box-shadow:0 4px 24px #0002;max-height:28vh;overflow:auto;white-space:pre-wrap;text-align:left';
      document.body.append(notice);
    }
    const text = (ready ? '预览更新失败，当前显示上次正常版本。' : '暂时无法生成预览。') + '修正内容后会自动恢复。\\n' + message;
    if (notice.textContent !== text) notice.textContent = text;
  }
  async function check() {
    try {
      const response = await fetch('${revisionPath}', { cache: 'no-store' });
      if (response.ok) {
        const state = await response.json();
        if (state.ready && state.revision !== initialRevision) {
          location.reload();
          return;
        }
        showError(state.error, state.ready);
      }
    } catch {}
    window.setTimeout(check, 1000);
  }
  check();
})();
`;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function injectClient(body, revision) {
  const document = body.toString('utf8');
  const script = `<script src="${clientPath}" data-revision="${revision}" defer></script>`;
  return Buffer.from(/<\/body\s*>/i.test(document) ? document.replace(/<\/body\s*>/i, `${script}</body>`) : `${document}${script}`);
}

/** Read only regular files. Immutable buffers keep the last good site intact during failed builds. */
function readSnapshot(directory, previous) {
  const files = new Map();
  const directories = new Set(['/']);
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = `/${path.relative(directory, absolute).split(path.sep).join('/')}`;
      if (entry.isDirectory()) {
        directories.add(relative);
        walk(absolute);
      } else if (entry.isFile()) {
        const stat = fs.statSync(absolute, { bigint: true });
        const identity = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
        const old = previous?.files.get(relative);
        files.set(relative, { identity, body: old?.identity === identity ? old.body : fs.readFileSync(absolute) });
      }
    }
  }
  walk(directory);
  if (!files.has('/index.html')) {
    throw new Error('构建结果缺少 dist/index.html。');
  }
  return { files, directories };
}

function shouldWatch(directory, filename) {
  if (!filename) return true;
  const parts = String(filename).split(/[\\/]/);
  if (directory === 'content' && parts[0] === 'templates') return false;
  return !parts.some((part) => part === '.git' || part === '.DS_Store' || part.endsWith('.part') || part.endsWith('.tmp') || part.endsWith('.swp') || part.endsWith('~'));
}

function sourceFingerprint(root) {
  const entries = [];
  function record(file, name) {
    const stat = fs.statSync(file, { bigint: true });
    entries.push(`${name}:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`);
  }
  function walk(directory, relative = '') {
    const current = path.join(root, directory, relative);
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      if (!shouldWatch(directory, name)) continue;
      if (entry.isDirectory()) walk(directory, name);
      else if (entry.isFile()) record(path.join(current, entry.name), `${directory}/${name}`);
    }
  }
  for (const directory of watchedDirectories) {
    if (fs.existsSync(path.join(root, directory))) walk(directory);
    else entries.push(`${directory}:missing`);
  }
  const config = path.join(root, 'site.config.json');
  if (fs.existsSync(config)) record(config, 'site.config.json');
  else entries.push('site.config.json:missing');
  return entries.join('\n');
}

/** Start an isolated local preview. Tests may supply a builder and port 0. */
export async function startPreviewServer({ root, port = 4173, debounceMs = 250, build, logger = console } = {}) {
  if (typeof root !== 'string' || !root) throw new Error('需要提供仓库根目录 root。');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT 必须是 0 到 65535 之间的整数。');
  if (!Number.isFinite(debounceMs) || debounceMs < 0) throw new Error('debounceMs 必须是非负数。');
  const absoluteRoot = path.resolve(root);
  const dist = path.join(absoluteRoot, 'dist');
  const session = randomUUID();
  const watchers = new Map();
  const directoryIdentities = new Map();
  const workers = new Set();
  let snapshot;
  let revision = 0;
  let lastError = null;
  let building = false;
  let pending = false;
  let closed = false;
  let timer;
  let closePromise;
  let attemptedFingerprint;

  const state = () => ({ revision: `${session}:${revision}`, ready: Boolean(snapshot), error: lastError, building });
  const reportError = (message) => logger.error?.(`${snapshot ? '预览更新失败，已保留上次正常页面' : '暂时无法生成预览，修正内容后将自动重试'}：\n${message}`);

  function buildFresh() {
    if (build) return Promise.resolve().then(() => build({ root: absoluteRoot }));
    return new Promise((resolve, reject) => {
      // A fresh worker reloads the complete module graph, including edited templates.
      const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        import(workerData.module).then(({ buildSite }) => buildSite({ root: workerData.root }))
          .then(() => parentPort.postMessage({ ok: true }))
          .catch((error) => parentPort.postMessage({ ok: false, message: error.message }));
      `, { eval: true, workerData: { root: absoluteRoot, module: pathToFileURL(path.join(absoluteRoot, 'src/build-site.mjs')).href } });
      workers.add(worker);
      let settled = false;
      worker.once('message', (result) => {
        settled = true;
        if (result.ok) resolve();
        else reject(new Error(result.message));
      });
      worker.once('error', (error) => {
        settled = true;
        reject(error);
      });
      worker.once('exit', (code) => {
        workers.delete(worker);
        if (!settled) reject(new Error(`构建进程退出，未返回结果（${code}）。`));
      });
    });
  }

  function scheduleBuild() {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void rebuild(false); }, debounceMs);
  }

  async function rebuild(force = true) {
    if (closed) return;
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      const fingerprint = sourceFingerprint(absoluteRoot);
      // Some platforms deliver events that happened before a watcher started.
      // Duplicate or delayed notifications must not create rebuild loops.
      if (!force && fingerprint === attemptedFingerprint) return;
      attemptedFingerprint = fingerprint;
      await buildFresh();
      if (closed) return;
      const next = readSnapshot(dist, snapshot);
      snapshot = next;
      revision += 1;
      lastError = null;
      logger.log?.('预览已更新，浏览器将自动刷新。');
    } catch (error) {
      if (!closed) {
        lastError = error.message;
        reportError(lastError);
      }
    } finally {
      building = false;
      if (pending && !closed) {
        pending = false;
        scheduleBuild();
      }
    }
  }

  function watchDirectory(name) {
    const directory = path.join(absoluteRoot, name);
    let identity;
    try {
      const stat = fs.statSync(directory);
      if (stat.isDirectory()) identity = `${stat.dev}:${stat.ino}`;
    } catch (error) {
      if (error.code !== 'ENOENT') logger.error?.(`无法读取监听目录 ${name}：${error.message}`);
    }
    // macOS may report child edits as parent-directory events. Rebind only
    // when the directory itself is created, removed or replaced.
    if (directoryIdentities.get(name) === identity) return false;
    watchers.get(name)?.close();
    watchers.delete(name);
    directoryIdentities.delete(name);
    if (!identity) return true;
    try {
      const watcher = fs.watch(directory, { recursive: true }, (_event, filename) => {
        if (shouldWatch(name, filename)) scheduleBuild();
      });
      watcher.on('error', (error) => logger.error?.(`无法监听 ${name}：${error.message}`));
      watchers.set(name, watcher);
      directoryIdentities.set(name, identity);
    } catch (error) {
      logger.error?.(`无法监听 ${name}：${error.message}`);
    }
    return true;
  }

  const server = http.createServer((request, response) => {
    const send = (status, body, contentType, headers = {}) => {
      const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
      response.writeHead(status, { ...cacheHeaders, 'Content-Type': contentType, 'Content-Length': data.length, ...headers });
      response.end(request.method === 'HEAD' ? undefined : data);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(405, '仅支持 GET 和 HEAD。', types['.txt'], { Allow: 'GET, HEAD' });
      return;
    }
    const queryIndex = request.url.indexOf('?');
    const rawPath = queryIndex < 0 ? request.url : request.url.slice(0, queryIndex);
    const query = queryIndex < 0 ? '' : request.url.slice(queryIndex);
    let name;
    try {
      name = decodeURIComponent(rawPath);
    } catch {
      send(400, '无效的页面地址。', types['.txt']);
      return;
    }
    if (!name.startsWith('/') || name.includes('\0') || name.includes('\\') || name.split('/').some((part) => part === '..' || part === '.')) {
      send(403, '不允许访问此路径。', types['.txt']);
      return;
    }
    name = name.replace(/\/{2,}/g, '/');
    if (name === revisionPath) {
      send(200, JSON.stringify(state()), types['.json']);
      return;
    }
    if (name === clientPath) {
      send(200, clientSource, types['.js']);
      return;
    }
    if (!snapshot) {
      const document = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>本地预览等待修复</title><body style="max-width:800px;margin:64px auto;padding:0 24px;font:16px/1.7 system-ui,sans-serif"><h1>暂时无法生成预览</h1><p>请修正下面的问题。保存后会自动重新构建并刷新此页。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(lastError || '正在构建，请稍候。')}</pre></body></html>`;
      send(503, injectClient(Buffer.from(document), state().revision), types['.html']);
      return;
    }
    const directory = name === '/' ? '/' : name.replace(/\/$/, '');
    if (snapshot.directories.has(directory)) {
      if (!name.endsWith('/')) {
        send(301, '', types['.txt'], { Location: `${name.split('/').map(encodeURIComponent).join('/')}/${query}` });
        return;
      }
      name += 'index.html';
    }
    let status = 200;
    let entry = snapshot.files.get(name);
    if (!entry) {
      status = 404;
      name = name.startsWith('/zh/') && snapshot.files.has('/zh/404.html') ? '/zh/404.html' : '/404.html';
      entry = snapshot.files.get(name);
    }
    if (!entry) {
      send(404, '页面不存在。', types['.txt']);
      return;
    }
    const extension = path.posix.extname(name);
    send(status, extension === '.html' ? injectClient(entry.body, state().revision) : entry.body, types[extension] || 'application/octet-stream');
  });

  const close = () => {
    if (closePromise) return closePromise;
    closed = true;
    clearTimeout(timer);
    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
    closePromise = Promise.all([
      ...[...workers].map((worker) => worker.terminate()),
      new Promise((resolve) => {
        if (!server.listening) resolve();
        else {
          server.close(resolve);
          server.closeAllConnections();
        }
      }),
    ]).then(() => undefined);
    return closePromise;
  };

  try {
    if (fs.existsSync(path.join(dist, 'index.html'))) {
      try {
        snapshot = readSnapshot(dist);
      } catch {
        // A fresh successful build can replace an incomplete old output directory.
      }
    }
    for (const name of watchedDirectories) watchDirectory(name);
    const rootWatcher = fs.watch(absoluteRoot, (_event, filename) => {
      const name = filename && String(filename);
      if (name === 'site.config.json') scheduleBuild();
      else if (watchedDirectories.includes(name)) {
        if (watchDirectory(name)) scheduleBuild();
      }
    });
    rootWatcher.on('error', (error) => logger.error?.(`无法监听网站配置：${error.message}`));
    watchers.set('root', rootWatcher);
    await rebuild();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    return { server, url, getState: state, close, rebuild };
  } catch (error) {
    await close();
    throw error;
  }
}
