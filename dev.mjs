// Servidor local: sirve la web y la API con una base de datos en memoria.  npm run dev → http://localhost:3000
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const routes = { '/api/state': './api/state.js', '/api/review': './api/review.js', '/api/comment': './api/comment.js' };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (routes[p]) return (await import(routes[p])).default(req, res);
  const f = path.join(process.cwd(), p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, d) => { if (e) { res.statusCode = 404; return res.end('404'); } res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); res.end(d); });
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
