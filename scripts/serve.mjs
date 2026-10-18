import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../docs/', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    const decoded = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(root, `.${decoded}`);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
