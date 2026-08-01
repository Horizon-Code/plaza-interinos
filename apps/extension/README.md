# Extensión de PlazaInterinos (fase 2)

Rellena las plazas en PADDOC dentro de la sesión del propio usuario.

**Línea roja:** la sesión de PADDOC nunca sale del navegador. La web de PlazaInterinos
solo envía la lista ordenada de IDs; el rellenado corre en `paddoc.js`, con las
cookies que adjunta el navegador. PlazaInterinos no custodia credenciales.

## Pendiente para activarla
1. Mapear los endpoints reales de PADDOC con las devtools (pestaña Network) durante
   una convocatoria activa y rellenar `PADDOC_V1` en `paddoc.js`.
2. Revisar las condiciones de uso del portal antes de ofrecerla como función de pago.
3. Añadir `background.js` (service worker) que mantenga el estado de sesión y
   reenvíe mensajes entre `bridge.js` y `paddoc.js`.

## Instalación en desarrollo
Chrome → Extensiones → Modo desarrollador → Cargar descomprimida → carpeta `apps/extension`.
