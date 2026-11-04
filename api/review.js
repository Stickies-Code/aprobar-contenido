import { redis, ID, clean, body, send, fail } from '../lib/db.js';

// POST /api/review  { week, item, status: 'ok' | 'no' | '', name }
// 'ok' = aprobado, 'no' = no aprobado, '' = quitar la valoración
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const b = await body(req);
  const week = String(b.week || ''), item = String(b.item || '');
  const name = clean(b.name, 40);
  const status = b.status === 'ok' || b.status === 'no' ? b.status : (b.approved === true ? 'ok' : '');
  if (!ID.test(week) || !ID.test(item) || !name) return send(res, 400, { error: 'Datos no válidos' });
  try {
    if (!status) { await redis('HDEL', `rev:${week}`, item); return send(res, 200, { review: null }); }
    const review = { status, approved: status === 'ok', by: name, at: new Date().toISOString() };
    await redis('HSET', `rev:${week}`, item, JSON.stringify(review));
    send(res, 200, { review });
  } catch (e) { fail(res, e); }
}
