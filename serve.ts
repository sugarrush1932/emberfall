// EMBERFALL - tiny static file server for local play.
// Serves only the game/ folder, on 127.0.0.1.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root: string = fileURLToPath(new URL('./game/', import.meta.url));

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function requestedPort(): number {
  const idx = process.argv.indexOf('--port');
  if (idx >= 0 && process.argv[idx + 1]) {
    const value = Number(process.argv[idx + 1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 8080;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    const type = mime[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
});

const port = requestedPort();
server.listen(port, '127.0.0.1', () => {
  console.log('Emberfall at http://127.0.0.1:' + port + '/');
});
