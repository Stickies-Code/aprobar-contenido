# Aprobar contenido · Criscolor

Web para que dirección apruebe o comente cada semana los posts (martes y jueves) y las tandas de historias (lunes, miércoles y viernes) de Instagram.

## Puesta en marcha (una sola vez)

1. **Vercel → Add New → Project →** importar `Stickies-Code/aprobar-contenido`. Sin build ni ajustes: es estático + funciones en `/api`.
2. **Proyecto → Storage → Connect Database → Upstash for Redis** (plan gratuito) → conectar a Production y Preview.
   Vercel añade solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. **Redeploy.** Comprueba que los botones Aprobar / No aprobar están activos (si sale «La base de datos aún no está conectada», falta el paso 2).
4. Si el proyecto tiene *Deployment Protection* activada, desactívala para Production para que el enlace se abra sin login de Vercel.

## Cómo funciona

- Cada pieza muestra solo el día, las imágenes en grande y dos botones: 👍 Aprobar / 👎 No aprobar (volver a pulsar quita la valoración).
- Los posts llevan su texto en el desplegable «Texto del post», con botón de copiar.
- Cada persona escribe su nombre la primera vez (se guarda en su navegador).
- La página se actualiza sola cada 20 s, así que ves las valoraciones en directo.
- Datos en Redis: `rev:<semana>` → `{ status: 'ok' | 'no', by, at }` por pieza.

## Añadir una semana

1. Sube las imágenes a `/img` con el nombre `<id de la pieza>-<n>.jpg` (p. ej. `p46-mar-1.jpg`), en 4:5 para posts y 9:16 para historias, ~810 px de ancho.
2. Añade el bloque de la semana al final de `data/weeks.js` (copia el anterior y cambia `id`, fechas, textos y `n` = nº de imágenes).
3. Commit + push: Vercel lo publica y la nueva semana aparece como pestaña (la última es la que se abre por defecto). Enlace directo a una semana: `/#w46`.
4. Si cambias una imagen ya publicada, súbele `v: 2` a esa pieza para saltar la caché.

## En local

`npm run dev` → http://localhost:3000 (base de datos en memoria, solo para probar).
