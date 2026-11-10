import { redis, ID, clean, body, send, fail } from '../lib/db.js';

// POST /api/uploaded  { week, item, done: true | false, name }
// Marca una pieza como ya subida a Instagram (o la desmarca).
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const b = await body(req);
  const week = String(b.week || ''), item = String(b.item || '');
  const name = clean(b.name, 40);
  if (!ID.test(week) || !ID.test(item)) return send(res, 400, { error: 'Datos no válidos' });
  try {
    if (!b.done) { await redis('HDEL', `up:${week}`, item); return send(res, 200, { upload: null }); }
    const upload = { done: true, by: name || '', at: new Date().toISOString() };
    await redis('HSET', `up:${week}`, item, JSON.stringify(upload));
    send(res, 200, { upload });
  } catch (e) { fail(res, e); }
}
