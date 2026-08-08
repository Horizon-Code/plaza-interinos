# Backlog

Puntos pendientes, ordenados por urgencia. Estado a 2026-08-08.

## Bloqueante

### 1. Promocionar `3ad5c4d` a producción

Producción sirve `b6e89c1`, el commit **anterior** al que añade la Pages Function.
Sin la función, `/api/*` cae en los estáticos de Cloudflare: `405` en POST y el
`index.html` en GET. El registro está roto en `plazainterinos.es`.

Cloudflare → Workers & Pages → plaza-interinos → Deployments → fila `main 3ad5c4d`
→ `···` → **Rollback to this deployment**. Es instantáneo, no reconstruye.

Verificar después:

```bash
curl -s https://plazainterinos.es/api/health          # debe dar {"status":"ok"}, no HTML
curl -i -X POST https://plazainterinos.es/api/auth/register \
  -H 'content-type: application/json' -d '{}'         # debe dar 400 (validación), no 405
```

El preview de ese commit (`f3fe8218.plaza-interinos.pages.dev`) ya se verificó
funcionando de extremo a extremo: Cloudflare → función → Fly → vuelta.

### 2. Averiguar por qué se redesplegó el commit viejo

El histórico de deployments es `b6e89c1` → `3ad5c4d` → `b6e89c1`. El último build
clonaba un SHA suelto (`branch b6e89c18… -> FETCH_HEAD`), firma de un
*Retry deployment*. Alguien reintentó el build antiguo y pisó producción.

Si fue un clic accidental, basta con saberlo. Si no, hay que revisar qué lo
disparó, porque volverá a pasar. **No usar "Retry deployment"** para actualizar:
reconstruye el mismo commit, no el último de la rama.

## Importante

### 3. Arranque en frío de la API: ~20 s

Medido: `GET /api/health` contra Fly tras inactividad tarda **20,6 s**. Con
`min_machines_running = 0` y auto-stop, la máquina está parada y arranca con la
primera petición. Un usuario que se registre tras un rato sin tráfico se come
esos 20 s, o un timeout.

Arrancar la máquina en Fly son típicamente 1-3 s; el resto es Node + Nest +
Prisma conectando a Neon. **Medir antes de decidir**: parar máquinas, cronometrar
y mirar `fly logs` para separar "máquina arrancada" de "Nest listo".

Opciones según lo que salga:

| Opción | Coste | Cuándo |
|---|---|---|
| Optimizar arranque de Nest/Prisma | 0 € | Si el grueso de los 20 s es el contenedor |
| Spinner honesto + timeout generoso en el cliente | 0 € | Paliativo, no arregla los 20 s |
| `min_machines_running = 1` en `infra/fly.toml` | ~3-4 €/mes | Si el arranque no se puede bajar |

Descartado: cron de keep-warm. Mantiene la máquina encendida igual, así que
cuesta lo mismo que `min = 1` con más piezas que se rompen.

### 4. Vigilar la facturación de Fly

El trial terminó y suspendió la app: el proxy aceptaba el TCP y cortaba el TLS
sin presentar certificado (`525` desde Cloudflare, `SSL_ERROR_SYSCALL` en curl).
Tarjeta ya añadida y app operativa.

Poner un aviso de gasto en el panel de Fly para no enterarse otra vez por una
caída. Esta es la causa que estuvo enmascarada bajo el `405`.

### 5. Vulnerabilidad en dependencias de runtime de la API

`npm audit --omit=dev` da 2 high que sí llegan a producción:

- `find-my-way <=9.6.0` — DDoS con HTTP/2 ([GHSA-c96f-x56v-gq3h](https://github.com/advisories/GHSA-c96f-x56v-gq3h))
- `@nestjs/platform-fastify` — arrastra la versión vulnerable de `find-my-way`

`npm audit fix` dice tener arreglo. El resto del recuento total (12: 7 moderate,
4 high, 1 critical) es de `vite`/`vitest`, solo desarrollo — menos urgente.

## Cuando toque

### 6. No hay CI

No existe `.github/workflows`. Nada ejecuta `npm test` antes de que Cloudflare
despliegue, así que un commit que rompa `@plazainterinos/core` llega a producción
sin fricción. Un workflow mínimo con `npm test` en push a `main` cubre el hueco.

### 7. La doc de despliegue no coincide con la realidad

[`infra/cloudflare-pages.md`](infra/cloudflare-pages.md) documenta el build command como:

```
npm install && npm run build -w @plazainterinos/web
```

El que ejecuta Cloudflare de verdad es:

```
npm install && npm run build -w @plazainterinos/core && npm run build -w @plazainterinos/web
```

Alinear la doc con el panel (o al revés). Lo demás del documento sí es correcto,
incluida la nota de no usar `_redirects` para proxyear a un backend externo.

### 8. Node 22 en modo mantenimiento

El build de Cloudflare avisa: `node-v22.22.3 is in LTS Maintenance mode and
nearing its end of life`. Solo recibe parches críticos. Planificar el salto a la
LTS siguiente sin prisa, pero sin olvidarlo.

## Verificado y cerrado

- La Pages Function proxya correctamente: en el preview de `3ad5c4d`,
  `GET /api/health` devuelve `{"status":"ok"}` en 0,29 s y
  `POST /api/auth/register` devuelve `400` de validación real de la API.
- El *root directory* del proyecto Pages es la raíz del repo, así que
  `functions/` se recoge donde está. No hay que mover nada.
- El `_redirects` que apuntaba a un host externo (nunca funcionó: *"Proxy (200)
  redirects can only point to relative paths"*) ya está eliminado en `3ad5c4d`.
