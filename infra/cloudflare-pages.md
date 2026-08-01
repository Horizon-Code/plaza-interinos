# Frontend en Cloudflare Pages

Build command:   `npm install && npm run build -w @plazainterinos/web`
Output dir:      `apps/web/dist`
Framework preset: Angular

Variables de entorno: ninguna en el front (la API se configura por proxy/URL).
En producción, apuntar las llamadas /api al dominio del backend (Fly) mediante
un rewrite en `_redirects` o una variable de entorno de build.
