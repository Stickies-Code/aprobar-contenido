import crypto from 'node:crypto';
import { redis, ID, clean, hash, body, send, fail } from '../lib/db.js';

// POST   /api/comment  { week, item, text, name, key }  → crea un comentario
// DELETE /api/comment  { week, id, key }                → borra un comentario propio
export default async function handler(req, res) {
  const b = await body(req);
  const week = String(b.week || '');
  if (!ID.test(week)) return send(res, 400, { error: 'Semana no válida' });
  const key = String(b.key || '');
  try {
    if (req.method === 'POST') {
      const item = String(b.item || ''), text = clean(b.text, 2000), name = clean(b.name, 40);
      if (!ID.test(item) || !text || !name || key.length < 8) return send(res, 400, { error: 'Datos no válidos' });
      const id = crypto.randomUUID();
      const c = { id, item, text, by: name, at: new Date().toISOString() };
      await redis('HSET', `com:${week}`, id, JSON.stringify({ ...c, owner: hash(key) }));
      return send(res, 200, { comment: { ...c, mine: true } });
    }
    if (req.method === 'DELETE') {
      const id = String(b.id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return send(res, 400, { error: 'Comentario no válido' });
      const raw = await redis('HGET', `com:${week}`, id);
      if (!raw) return send(res, 200, { ok: true });
      if (JSON.parse(raw).owner !== hash(key)) return send(res, 403, { error: 'Solo puedes borrar tus comentarios' });
      await redis('HDEL', `com:${week}`, id);
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'Método no permitido' });
  } catch (e) { fail(res, e); }
}
