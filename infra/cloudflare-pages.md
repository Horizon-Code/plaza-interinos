# Frontend en Cloudflare Pages

Build command:   `npm install && npm run build -w @plazainterinos/web`
Output dir:      `apps/web/dist/browser`
Framework preset: Angular

Variables de entorno: ninguna en el front (la API se configura por proxy/URL).

## API en produccion

El frontend llama siempre a rutas relativas `/api/*`. En local las resuelve el
proxy de Angular (`apps/web/proxy.conf.json`). En produccion las resuelve una
Cloudflare Pages Function en `functions/api/[[path]].ts`, que reenvia la peticion
a Fly:

```text
https://plazainterinos.es/api/auth/register
  -> functions/api/[[path]].ts
  -> https://plazainterinos-api.fly.dev/api/auth/register
```

No usar `_redirects` para proxyear `/api/*` a `https://plazainterinos-api.fly.dev`.
Cloudflare Pages solo permite proxy rewrites con URLs relativas del propio sitio;
para un backend externo hay que usar Pages Functions.
