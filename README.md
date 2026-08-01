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
                     motor de reglas con explicación, evaluación, ranking, comprobación,
                     PARSERS de PDF (vacantes/candidatos) y catálogo de cuerpos/
                     especialidades. 55 tests (vitest). NO depende de web ni de HTTP.
apps/api             NestJS. Módulos: auth (JWT), perfil, convocatoria, evaluacion
                     (usa el core), pagos (Stripe), geo (Nominatim), fuel (precios
                     oficiales del combustible), pdf (proxy de descarga). Prisma + PostgreSQL.
apps/web             Angular 22. Flujo: importar (PDF vacantes + candidatos → "Descubrir
                     vacantes") → perfil dinámico → lista con coste €/día → comprobación.
apps/extension       Manifest V3. Rellena en el portal dentro de la sesión del usuario.
tools/build-catalog  Script Node+pdfjs: regenera el catálogo y vuelca fixtures de test.
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

- Núcleo, reglas, ranking, comprobación y **parsers de PDF**: probados (55 tests en verde).
- **Parser de vacantes calibrado con el PDF oficial real** (773 págs.): 4603 fichas, 0 errores.
- **Búsqueda de candidatos** por nombre sobre el PDF real (693 págs.): localiza cuerpos,
  especialidades y orden.
- Catálogo de cuerpos/especialidades generado del PDF real (7 cuerpos, 143 especialidades).
- Backend NestJS completo, incluidos geo/fuel/pdf-proxy: probado en vivo.
- Frontend Angular 22: importar (drag&drop + URL de PDF), perfil dinámico con
  condiciones detectadas, coste de combustible por vacante. Compila en producción.
- E2E completo con los dos PDFs reales verificado de punta a punta.

## Pendiente (en orden)

1. **Geocodificar los centros de Aragón** (catálogo con lat/lon). Las vacantes reales
   no traen coordenadas, así que hoy la distancia/coste solo se calcula si el centro
   tiene lat/lon; sin ellas se muestra el aviso "distancia sin calcular". Esta es la
   siguiente pieza para que la ordenación por cercanía y el coste €/día sean plenos.
2. Mapear los endpoints reales del portal para activar la extensión (fase 2).
3. Pantalla de login real (hoy la web abre sesión demo automática).
4. Verificar `plazainterinos.es` en la OEPM antes de invertir en marca.
