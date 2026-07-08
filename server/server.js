const http = require('http');
const fs = require('fs');
const path = require('path');
const { appendMessage, readSince } = require('./chat-store');

const PORT = process.env.PORT || 4321;
const SITE = path.join(__dirname, '..', 'site');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function body(req) {
  return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
}
function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/api/chat' && req.method === 'POST') {
    try {
      const { text } = JSON.parse(await body(req) || '{}');
      return json(res, 200, appendMessage({ from: 'colleague', text }));
    } catch {
      return json(res, 400, { error: 'bad request' });
    }
  }
  if (u.pathname === '/api/chat' && req.method === 'GET') {
    return json(res, 200, { messages: readSince(Number(u.searchParams.get('since') || 0)) });
  }

  // static files
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(SITE, path.normalize(p));
  if (!file.startsWith(SITE)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Spanko läuft auf http://localhost:${PORT}`));
