# Despliegue de PlazaInterinos

Arquitectura elegida para un producto ESTACIONAL (convocatorias): escala a cero
en los meses muertos, escala solo en campaña. Optimiza calidad/precio sin atarse
a un proveedor (el backend va en Docker, portable a cualquier sitio).

```
Frontend  →  Cloudflare Pages     (estático, CDN global, ~0 €)
Backend   →  Fly.io               (Docker NestJS, escala a cero)
Base datos→  Neon                 (PostgreSQL serverless, escala a cero)
Extensión →  Chrome Web Store     (cuando esté lista, fase 2)
Dominio   →  plazainterinos.es
```

## Por qué esta terna y no AWS (todavía)
El producto duerme ~9 meses al año. Fly + Neon se apagan solos en reposo, así que
esos meses cuestan casi nada. AWS con RDS factura la BD encendida todo el año la
uses o no (~30-45 €/mes en vacío). AWS gana a gran escala con tráfico sostenido;
mientras el patrón sea estacional, esta terna es más barata.

## Cuándo reconsiderar AWS / Kubernetes
- Cuando el tráfico deje de ser estacional (varias comunidades con campañas
  solapadas que rellenen los meses muertos).
- Cuando el volumen (muchos miles de usuarios de pago) haga compensar el precio
  por unidad de AWS frente a su suelo fijo.
- Kubernetes: solo con varios servicios y alguien dedicado a operarlo. Con un
  backend + una BD + un front estático, es sobreingeniería.
El backend en Docker hace que migrar a AWS (App Runner / ECS + RDS) sea cuestión
de horas, no de reescritura. Empezar ligero no cierra esa puerta.

## Escalar a España = escalar DATOS, no infraestructura
El cuello de botella al crecer no es aguantar usuarios: es entender los 17
formatos de convocatoria (PADDOC en Aragón, y su equivalente en cada comunidad).
El parser ya usa adaptadores versionados por región (`aragon_v1`, futuro
`madrid_v1`…). Cada comunidad nueva es trabajo de mapear su formato y reglas, no
de tocar la infraestructura. Orden correcto: Aragón perfecto → cobrar → validar →
segunda comunidad.

## Pasos de despliegue
1. Neon: crear proyecto PostgreSQL, copiar la connection string a `DATABASE_URL`.
2. Backend (Fly): `fly launch` con `infra/fly.toml`, definir secrets
   (`DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`), `fly deploy`.
   Antes del primer arranque: `npx prisma migrate deploy`.
3. Frontend (Cloudflare Pages): conectar el repo, build según
   `infra/cloudflare-pages.md`, apuntar `/api` al dominio de Fly.
4. Dominio: `plazainterinos.es` → Cloudflare (front) y subdominio `api.` → Fly.
