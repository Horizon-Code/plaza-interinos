# Despliegue

Guia operativa para desplegar PlazaInterinos en produccion.

## Arquitectura

- Frontend: Cloudflare Pages, servido en `https://plazainterinos.es`.
- API: Fly.io, app `plazainterinos-api`, servida en `https://plazainterinos-api.fly.dev`.
- Base de datos: PostgreSQL en Neon.
- Proxy `/api`: Cloudflare Pages Function en `functions/api/[[path]].ts`.

El navegador llama siempre a rutas relativas:

```text
https://plazainterinos.es/api/*
```

Cloudflare ejecuta `functions/api/[[path]].ts` y reenvia la peticion a:

```text
https://plazainterinos-api.fly.dev/api/*
```

## Requisitos

- Cambios subidos a GitHub en `main`.
- CLI de Fly instalada y con sesion iniciada.
- Proyecto Cloudflare Pages conectado al repo.
- Base de datos Neon creada.

Comprobar Fly:

```bash
fly auth whoami
```

Si no hay sesion:

```bash
fly auth login
```

## Variables de produccion

### Fly

La API necesita estos secrets en Fly:

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="..." \
  --app plazainterinos-api
```

Solo esos dos. Ya no hace falta `RESEND_API_KEY`: desde que se entra con Google
la aplicacion no envia ningun correo. Tampoco las claves de Stripe, porque el
modulo de pagos esta desactivado mientras el servicio sea gratuito.

Variables no secretas definidas en `infra/fly.toml`:

```toml
CORS_ORIGIN = 'https://plazainterinos.es'
APP_URL = 'https://plazainterinos.es'
GOOGLE_CLIENT_ID = '...apps.googleusercontent.com'
PORT = '3000'
```

`GOOGLE_CLIENT_ID` es el identificador publico de la aplicacion en Google Cloud.
Va aqui y no en `fly secrets` porque no es un secreto: viaja en cada peticion de
acceso y la propia API se lo sirve al navegador en `/api/auth/google/config`.
Se sirve desde la API en vez de compilarlo en la web para que cambiarlo no
obligue a reconstruir el frontend.

Sin el, nadie puede entrar: la API responde `clientId: null` y la web enseña un
aviso en lugar del boton. Es lo primero que hay que mirar si nadie puede acceder.

En Google Cloud, el cliente OAuth tiene que llevar `https://plazainterinos.es`
en **Origenes autorizados de JavaScript**, o el navegador no dejara ni pintar el
boton. Los URI de redireccion se quedan vacios: el flujo devuelve el token al
propio navegador y no usa redirecciones.

Ver secrets configurados:

```bash
fly secrets list --app plazainterinos-api
```

No imprime los valores, solo los nombres.

### Cloudflare Pages

El frontend no necesita variables de entorno para llamar a la API. Usa `/api/*`
y la Pages Function hace de proxy hacia Fly.

Configuracion esperada en Cloudflare Pages:

```text
Build command:
npm install && npm run build -w @plazainterinos/web

Build output directory:
apps/web/dist/browser

Root directory:
repo root / vacio
```

`apps/web/public/_redirects` manda cualquier ruta desconocida a `index.html`.
Hace falta porque el enlace del correo entra directo en `/entrar/callback`, que
es una ruta de Angular y no un fichero: sin el fallback, Cloudflare devuelve 404
y nadie puede entrar. `/api/*` no se ve afectado, lo atiende antes la Pages
Function de `functions/api/[[path]].ts`.

Tras el primer despliegue conviene comprobarlo:

```bash
curl -I https://plazainterinos.es/entrar/callback?token=prueba
```

Debe responder `200` con el HTML de la aplicacion, no `404`.

El root directory debe ser la raiz del repo para que Cloudflare detecte:

```text
functions/api/[[path]].ts
```

Si el root directory apunta a `apps/web`, la funcion no se desplegara y `/api/*`
puede devolver `405 Method Not Allowed`.

## Desplegar backend en Fly

Desde la raiz del repo:

```bash
fly deploy --config infra/fly.toml
```

Ver estado:

```bash
fly status --app plazainterinos-api
```

Ver logs:

```bash
fly logs --app plazainterinos-api
```

## Migraciones de base de datos

Antes del primer despliegue, o cuando haya migraciones nuevas de Prisma, aplicar:

```bash
fly ssh console --app plazainterinos-api -C "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma"
```

Si Fly no encuentra el schema dentro de la imagen, entrar a la consola y localizar
la ruta real:

```bash
fly ssh console --app plazainterinos-api
pwd
ls
find . -path '*schema.prisma'
```

Luego ejecutar `npx prisma migrate deploy` con esa ruta.

## Desplegar frontend en Cloudflare Pages

Normalmente basta con subir cambios a `main`:

```bash
git push origin main
```

Cloudflare Pages deberia lanzar un deploy automatico.

Si hay que forzarlo:

1. Entrar en Cloudflare.
2. Ir al proyecto de Pages.
3. Abrir `Deployments`.
4. Pulsar `Retry deployment` o `Create deployment`.
5. Confirmar que el commit desplegado es el ultimo de `main`.

## Verificacion despues del despliegue

API directa en Fly:

```bash
curl https://plazainterinos-api.fly.dev/api/health
```

API pasando por Cloudflare Pages Function:

```bash
curl https://plazainterinos.es/api/health
```

Frontend:

```bash
curl -I https://plazainterinos.es/
```

Configuracion de acceso pasando por el dominio publico:

```bash
curl https://plazainterinos.es/api/auth/google/config
```

Resultados esperados:

- `{"clientId":"...apps.googleusercontent.com"}`: la entrada esta configurada.
- `{"clientId":null}`: falta `GOOGLE_CLIENT_ID` en Fly. Nadie puede entrar.
- `405 Method Not Allowed`: Cloudflare no esta ejecutando la Pages Function para `/api/*`.
- `5xx`: revisar `fly logs --app plazainterinos-api`.

La entrada completa solo se puede comprobar desde el navegador, pulsando el
boton de Google en `https://plazainterinos.es/entrar`.

## Comandos habituales

Subir cambios:

```bash
git status
git add .
git commit -m "Mensaje del cambio"
git push origin main
```

Desplegar solo backend:

```bash
fly deploy --config infra/fly.toml
```

Ver logs backend:

```bash
fly logs --app plazainterinos-api
```

Escalar o despertar la app si hiciera falta:

```bash
fly status --app plazainterinos-api
```

## Problemas comunes

### `405 Method Not Allowed` en `https://plazainterinos.es/api/...`

Cloudflare Pages esta tratando `/api` como ruta estatica, no como funcion.

Revisar:

- Que existe `functions/api/[[path]].ts`.
- Que Cloudflare Pages usa la raiz del repo como root directory.
- Que el output dir es `apps/web/dist/browser`.
- Que el ultimo deploy incluye el commit con la funcion.

### CORS en produccion

El navegador no deberia llamar directamente a:

```text
https://plazainterinos-api.fly.dev/api/*
```

Debe llamar a:

```text
https://plazainterinos.es/api/*
```

Si en Network aparece `plazainterinos-api.fly.dev`, el frontend desplegado no es el
ultimo o el codigo no usa rutas relativas `/api`.

### Nadie puede entrar

Comprobar en este orden:

1. Que `GOOGLE_CLIENT_ID` esta en `infra/fly.toml` y desplegado:

```bash
curl https://plazainterinos.es/api/auth/google/config
```

   Si devuelve `clientId: null`, la variable no ha llegado al contenedor.

2. Que en Google Cloud el cliente OAuth tiene `https://plazainterinos.es` en
   **Origenes autorizados de JavaScript**. Si falta, el navegador bloquea el
   boton y en la consola aparece un error de origen no permitido.

3. Que la pantalla de consentimiento de Google esta **publicada** y no "en
   pruebas": en pruebas solo entran los correos dados de alta como usuarios de
   prueba, y el resto recibe un error de acceso denegado.

### `401 Unauthorized` al entrar con Google

El ID token no ha superado la verificacion: o ha caducado (duran una hora), o
el `GOOGLE_CLIENT_ID` de la API no es el mismo con el que el navegador pidio el
token. Que coincidan exactamente.



### API caida o `5xx`

Mirar estado y logs:

```bash
fly status --app plazainterinos-api
fly logs --app plazainterinos-api
```

Comprobar que `DATABASE_URL` existe como secret y apunta a Neon.

