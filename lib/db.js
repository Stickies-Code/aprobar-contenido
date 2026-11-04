// Acceso a Redis (Upstash) por su API REST, sin dependencias.
// Vercel inyecta KV_REST_API_URL / KV_REST_API_TOKEN (o UPSTASH_REDIS_REST_URL / _TOKEN)
// al conectar la base de datos «Upstash for Redis» desde el Marketplace.
import crypto from 'node:crypto';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const DEV = process.env.LOCAL_DEV === '1';
const mem = new Map(); // solo para pruebas en local

export const configured = () => Boolean((URL && TOKEN) || DEV);

export async function redis(...cmd) {
  if (!URL || !TOKEN) {
    if (!DEV) throw Object.assign(new Error('Base de datos no conectada'), { status: 503 });
    const [op, key, ...a] = cmd; const h = mem.get(key) || new Map(); mem.set(key, h);
    if (op === 'HSET') { h.set(a[0], a[1]); return 1; }
    if (op === 'HGET') return h.get(a[0]) ?? null;
    if (op === 'HDEL') return h.delete(a[0]) ? 1 : 0;
    if (op === 'HGETALL') return [...h.entries()].flat();
    throw new Error('op');
  }
  const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis ${r.status}`);
  return j.result;
}

export const hgetall = async key => {
  const flat = (await redis('HGETALL', key)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {} }
  return out;
};

export const ID = /^[a-z0-9-]{1,40}$/;
export const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
export const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch (e) { return {}; }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function fail(res, e) {
  send(res, e.status || 500, { error: e.status === 503 ? 'Base de datos no conectada' : 'Error del servidor' });
}
