import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.env.MANAGERSL_WEB_DIR || 'dist');
const port = Number(process.env.MANAGERSL_WEB_PORT || 19006);
const host = process.env.MANAGERSL_WEB_HOST || '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeFile(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const absolute = resolve(root, clean);
  return absolute === root || absolute.startsWith(`${root}${sep}`) ? absolute : null;
}

function resolveRequest(pathname) {
  const direct = safeFile(pathname);
  if (!direct) return null;
  if (existsSync(direct) && statSync(direct).isFile()) return direct;

  const html = safeFile(`${pathname.replace(/\/$/, '')}.html`);
  if (html && existsSync(html) && statSync(html).isFile()) return html;

  const nestedIndex = join(direct, 'index.html');
  if (existsSync(nestedIndex) && statSync(nestedIndex).isFile()) return nestedIndex;

  const fallback = join(root, 'index.html');
  return existsSync(fallback) ? fallback : null;
}

if (!existsSync(root)) {
  console.error(`Web build not found: ${root}`);
  console.error('Run: npm run web:preview:build');
  process.exit(1);
}

const server = createServer((request, response) => {
  const file = resolveRequest(request.url || '/');
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = extname(file).toLowerCase();
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`ManagerSL web preview: http://${host}:${port}`);
});
