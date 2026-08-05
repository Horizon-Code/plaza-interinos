# PlazaInterinos

Asistente de selección de vacantes docentes para interinos. *Elige destino con datos, no con agotamiento.*

Convierte el PDF oficial de una convocatoria en una lista ordenada, filtrada y **explicada** según el perfil del docente, comprueba la selección antes de enviarla, y (opcionalmente) la rellena en el portal oficial dentro de la sesión del propio usuario.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (standalone, signals, zoneless) |
| Backend | NestJS 11 sobre Fastify |
| Base de datos | PostgreSQL vía Prisma |
| Lógica de dominio | `@plazainterinos/core` — TypeScript puro, compartido |
| Extensión | Manifest V3 (rellenar en el portal, fase 2) |
| Parser | TypeScript + pdfjs-dist, **en el navegador** (`packages/core/src/parsers`) |
| Despliegue | Cloudflare Pages + Fly.io + Neon (ver `infra/`) |

## Arranque en local

```bash
npm install
cd apps/api && npx prisma generate && npx prisma migrate dev && npm run db:seed && cd ../..
npm run dev        # API (:3000) + web (:4200)
```

Requisitos: Node 22.22.3+ (Angular 22) y una PostgreSQL local o de Neon en `DATABASE_URL`.
En WSL, la `DATABASE_URL` usa el socket local: `postgresql://usuario@localhost:5432/plazainterinos?schema=public&host=/var/run/postgresql`.

## Estructura

```
packages/core        Dominio en TypeScript puro: modelos, extractor de etiquetas,
                     motor de reglas con explicación, evaluación, ranking, orden en
                     cascada, comprobación, PARSERS de PDF (vacantes/candidatos) y
                     catálogos (cuerpos/especialidades y centros geolocalizados).
                     75 tests (vitest). NO depende de web ni de HTTP.
apps/api             NestJS. Módulos: auth (JWT), perfil, convocatoria (geolocaliza las
                     vacantes al importar), evaluacion (usa el core), pagos (Stripe),
                     geo (Nominatim), fuel (precios oficiales del combustible),
                     pdf (proxy de descarga). Prisma + PostgreSQL.
apps/web             Angular 22. Seis pasos: convocatoria → perfil → filtrar → ordenar →
                     lista (tarjetas o tabla, con coste €/día) → comprobación.
                     Filtrar y ordenar son opcionales; todo persiste en localStorage.
apps/extension       Manifest V3. Rellena en el portal dentro de la sesión del usuario.
tools/build-catalog  Scripts Node: `index.mjs` regenera el catálogo de cuerpos y vuelca
                     fixtures de test; `centros.mjs` descarga los centros educativos
                     geolocalizados del WFS de IDEAragón (`npm run build:centros`).
infra                Despliegue: fly.toml, guía Cloudflare, razonamiento de escalado.
docs                 PDFs oficiales de referencia (vacantes.pdf, candidatos.pdf).
```

## Principio de arquitectura

El valor vive en `@plazainterinos/core`, que no depende de nada. Cada capa exterior
(API, web, extensión) es reemplazable sin tocar la lógica. La línea roja de seguridad
—la sesión del portal oficial nunca sale del navegador del usuario— está incrustada
en la separación de piezas: solo la extensión toca el portal, y lo hace en la máquina
del usuario.

## Estado

- Núcleo, reglas, ranking, orden, comprobación y **parsers de PDF**: probados (75 tests en verde).
- **Parser de vacantes calibrado con el PDF oficial real** (773 págs.): 4603 fichas, 0 errores.
- **Búsqueda de candidatos** por nombre sobre el PDF real (693 págs.): localiza cuerpos,
  especialidades y orden.
- Catálogo de cuerpos/especialidades generado del PDF real (7 cuerpos, 143 especialidades).
- **Centros geolocalizados**: 961 centros de Aragón con coordenadas WGS84, cruzados por
  el código oficial de 8 dígitos que trae el PDF. Cubre el 97 % de las vacantes reales;
  el resto (equipos de orientación, sin edificio propio) cae a revisión manual.
- **Las plazas obligatorias nunca se filtran**: los filtros de usuario (voluntarias,
  localidades, centros) solo pueden descartar voluntarias. Cubierto por tests.
- Backend NestJS completo, incluidos geo/fuel/pdf-proxy: probado en vivo.
- Frontend Angular 22: seis pasos, vista tabla, orden en cascada y persistencia en
  localStorage. Compila en producción.
- E2E completo con los dos PDFs reales verificado de punta a punta.

## Pendiente (en orden)

1. Mapear los endpoints reales del portal para activar la extensión (fase 2).
2. Pantalla de login real (hoy la web abre sesión demo automática).
3. Verificar `plazainterinos.es` en la OEPM antes de invertir en marca.
