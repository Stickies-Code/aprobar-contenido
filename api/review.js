import { redis, ID, clean, body, send, fail } from '../lib/db.js';

// POST /api/review  { week, item, approved, name }
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const b = await body(req);
  const week = String(b.week || ''), item = String(b.item || '');
  const name = clean(b.name, 40);
  if (!ID.test(week) || !ID.test(item) || !name) return send(res, 400, { error: 'Datos no válidos' });
  const review = { approved: b.approved === true, by: name, at: new Date().toISOString() };
  try {
    await redis('HSET', `rev:${week}`, item, JSON.stringify(review));
    send(res, 200, { review });
  } catch (e) { fail(res, e); }
}
