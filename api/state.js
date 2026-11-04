import { hgetall, ID, send, fail } from '../lib/db.js';

// GET /api/state?week=w45 → { reviews: { <pieza>: { status, by, at } } }
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const week = new URL(req.url, 'http://x').searchParams.get('week') || '';
  if (!ID.test(week)) return send(res, 400, { error: 'Semana no válida' });
  try { send(res, 200, { reviews: await hgetall(`rev:${week}`) }); }
  catch (e) { fail(res, e); }
}
