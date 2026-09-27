import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['scripts/build.mjs'], {stdio: 'inherit'});
const root = path.resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.pdf':'application/pdf','.ico':'image/x-icon','.xml':'application/xml'};
http.createServer((req,res) => {
  let name;
  try {name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);} catch {res.writeHead(400).end();return;}
  let file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403).end();return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!name.endsWith('/')) {res.writeHead(301, {Location: name + '/'}).end();return;}
    file = path.join(file, 'index.html');
  }
  let status=200;
  if (!fs.existsSync(file)) {file=path.join(root,'404.html'); status=404;}
  res.writeHead(status, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + (process.env.PORT || 4173)));
