# Arranque local

Guia para levantar PlazaInterinos en local con frontend Angular, API NestJS y PostgreSQL.

## Requisitos

- Node.js 22.22.3 o superior.
- npm.
- Docker Desktop si se quiere levantar PostgreSQL en contenedor.
- PostgreSQL local o remoto accesible desde la API.

El proyecto es un monorepo npm con estos workspaces principales:

- `packages/core`: logica compartida.
- `apps/api`: backend NestJS sobre Fastify.
- `apps/web`: frontend Angular.

## Instalacion

Desde la raiz del repo:

```bash
npm install
```

Si la maquina tiene Node 18 por defecto, Angular 22 y parte del backend pueden fallar. Comprueba la version:

```bash
node -v
```

Si no tienes Node 22 instalado, puedes usarlo de forma temporal con npm:

```bash
npm exec --yes --package node@22.22.3 -- node -v
```

En esta maquina quedo disponible en la cache de npm. Para ejecutar comandos largos con ese runtime se puede anteponer su `bin` al `PATH`:

```bash
PATH=/home/rubenpasamar/.npm/_npx/ca3942424f2c6fc5/node_modules/node/bin:$PATH npm run web
```

En otro equipo, lo recomendable es instalar Node 22 con `nvm`, `fnm`, Volta o el instalador oficial, y no depender de esa ruta de cache.

## Variables de entorno de la API

La API lee su configuracion desde `apps/api/.env`.

Ejemplo para PostgreSQL en Docker publicado en el puerto `55432`:

```env
DATABASE_URL="postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?schema=public"
JWT_SECRET="cambia-esto-en-produccion"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
CAMPAIGN_PRICE_CENTS="2499"
CORS_ORIGIN="http://localhost:4200"
PORT="3000"
```

El puerto `55432` evita choques con una PostgreSQL local que ya pueda estar usando `5432`.

## PostgreSQL con Docker

### Con Docker integrado en WSL o Linux

```bash
docker run --name plazainterinos-postgres-55432 \
  -e POSTGRES_USER=plazainterinos \
  -e POSTGRES_PASSWORD=plazainterinos \
  -e POSTGRES_DB=plazainterinos \
  -p 55432:5432 \
  -d postgres:16
```

Comprobar que responde:

```bash
psql "postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?sslmode=disable" \
  -c "select current_user, current_database();"
```

### Con Docker Desktop instalado en Windows, desde WSL

Si `docker` no existe dentro de WSL, pero Docker Desktop esta instalado en Windows, se puede usar el binario de Windows:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" --version
```

Si Docker Desktop no esta arrancado:

```bash
"/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe"
```

Crear PostgreSQL:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --name plazainterinos-postgres-55432 \
  -e POSTGRES_USER=plazainterinos \
  -e POSTGRES_PASSWORD=plazainterinos \
  -e POSTGRES_DB=plazainterinos \
  -p 55432:5432 \
  -d postgres:16
```

Ver contenedores:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ps --format "{{.Names}} {{.Ports}}"
```

Arrancar/parar el contenedor:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" start plazainterinos-postgres-55432
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" stop plazainterinos-postgres-55432
```

## Preparar la base de datos

Primero genera Prisma Client:

```bash
DATABASE_URL="postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?schema=public" \
npx prisma generate --schema apps/api/prisma/schema.prisma
```

Lo normal es aplicar migraciones con Prisma:

```bash
DATABASE_URL="postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?schema=public" \
npx prisma migrate dev --schema apps/api/prisma/schema.prisma
```

Si el `schema-engine` de Prisma falla en WSL con un error vacio, se pueden aplicar las migraciones SQL directamente al contenedor:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" cp apps/api/prisma/migrations/20260725083757_init/migration.sql plazainterinos-postgres-55432:/tmp/001_init.sql
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" cp apps/api/prisma/migrations/20260725161731_profile_travel_car_conditions/migration.sql plazainterinos-postgres-55432:/tmp/002_profile_travel.sql
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" cp apps/api/prisma/migrations/20260726103717_bandas_trayecto_jornada/migration.sql plazainterinos-postgres-55432:/tmp/003_bandas.sql

"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" exec plazainterinos-postgres-55432 psql -U plazainterinos -d plazainterinos -f /tmp/001_init.sql
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" exec plazainterinos-postgres-55432 psql -U plazainterinos -d plazainterinos -f /tmp/002_profile_travel.sql
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" exec plazainterinos-postgres-55432 psql -U plazainterinos -d plazainterinos -f /tmp/003_bandas.sql
```

Cargar datos demo:

```bash
DATABASE_URL="postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?schema=public" \
npm run db:seed -w @plazainterinos/api
```

## Levantar la aplicacion

### Opcion recomendada: todo junto

Desde la raiz:

```bash
npm run dev
```

Este comando compila `packages/core` y levanta:

- API en `http://localhost:3000`.
- Web en `http://localhost:4200`.

### Opcion separada

Terminal 1, API:

```bash
DATABASE_URL="postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?schema=public" \
npm run api
```

Terminal 2, frontend:

```bash
npm run web
```

La web queda disponible en:

```text
http://localhost:4200/
```

La API queda disponible en:

```text
http://localhost:3000/api/health
```

## Proxy del frontend

Angular usa `apps/web/proxy.conf.json` para reenviar llamadas `/api` a la API local:

```json
{ "/api": { "target": "http://127.0.0.1:3000", "secure": false } }
```

Aunque internamente el proxy use `127.0.0.1`, en el navegador se recomienda abrir:

```text
http://localhost:4200/
```

Asi coincide con `CORS_ORIGIN="http://localhost:4200"`.

En produccion, `/api/*` no se resuelve con `_redirects`. Cloudflare Pages no puede
usar `_redirects` como proxy hacia un dominio externo de Fly. Para eso se usa la
Pages Function `functions/api/[[path]].ts`, que reenvia las peticiones a:

```text
https://plazainterinos-api.fly.dev/api/*
```

## Comprobaciones rapidas

Frontend:

```bash
curl -I http://localhost:4200/
```

API:

```bash
curl http://localhost:3000/api/health
```

Registro a traves del proxy del frontend:

```bash
curl -i -X POST http://localhost:4200/api/auth/register \
  -H 'Content-Type: application/json' \
  --data '{"email":"debug@example.com","password":"demo12345","name":"Debug","accessCode":"test"}'
```

Debe devolver `201 Created` si la API, el proxy y PostgreSQL estan bien conectados.

## Problemas comunes

### `ERR_REQUIRE_ESM` al arrancar la API

Suele pasar cuando se ejecuta con Node 18. Usa Node 22.22.3 o superior.

### `Can't reach database server at /var/run/postgresql:5432`

La `DATABASE_URL` apunta al socket local de PostgreSQL, pero no hay servidor escuchando ahi. Cambia `apps/api/.env` para apuntar al PostgreSQL disponible, por ejemplo:

```env
DATABASE_URL="postgresql://plazainterinos:plazainterinos@127.0.0.1:55432/plazainterinos?schema=public"
```

### `502 Bad Gateway` o `405 Method Not Allowed` en `/api/auth/register`

En local, un `502` lo devuelve el proxy de Angular cuando no puede conectar con la API. Comprueba:

```bash
curl http://localhost:3000/api/health
curl http://localhost:4200/api/health
```

Si el primero funciona y el segundo no, revisa `apps/web/proxy.conf.json` y reinicia `npm run web`.

En produccion, un `405 Method Not Allowed` en `https://plazainterinos.es/api/...`
suele indicar que Cloudflare Pages esta tratando `/api` como una ruta estatica en
vez de ejecutarla mediante la Pages Function `functions/api/[[path]].ts`.

### Docker existe en Windows pero no en WSL

Usa `docker.exe` desde la ruta de Docker Desktop o activa la integracion WSL en Docker Desktop.

Ruta habitual:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
```

### El puerto `5432` no conecta al contenedor correcto

En WSL puede existir otra PostgreSQL o una redireccion distinta en `127.0.0.1:5432`. Publica el contenedor en `55432` y usa esa URL en `DATABASE_URL`.
