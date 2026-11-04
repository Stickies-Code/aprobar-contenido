import { hgetall, ID, hash, send, fail } from '../lib/db.js';

// GET /api/state?week=w45&key=<clave del dispositivo>
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const q = new URL(req.url, 'http://x').searchParams;
  const week = q.get('week') || '';
  if (!ID.test(week)) return send(res, 400, { error: 'Semana no válida' });
  const mine = q.get('key') ? hash(q.get('key')) : null;
  try {
    const [reviews, raw] = await Promise.all([hgetall(`rev:${week}`), hgetall(`com:${week}`)]);
    const comments = Object.values(raw).map(({ owner, ...c }) => ({ ...c, mine: !!mine && owner === mine }));
    send(res, 200, { reviews, comments });
  } catch (e) { fail(res, e); }
}
