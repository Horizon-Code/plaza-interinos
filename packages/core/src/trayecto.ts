/** Texto compartido por tarjetas, tablas, comprobación y exportación. */
export function formatearTrayecto(datos: { distanceKm?: number | null; travelMinutes?: number | null }): string {
  const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  const partes: string[] = [];
  if (datos.travelMinutes != null && Number.isFinite(datos.travelMinutes) && datos.travelMinutes >= 0) {
    partes.push(`${numero.format(datos.travelMinutes)} min`);
  }
  if (datos.distanceKm != null && Number.isFinite(datos.distanceKm) && datos.distanceKm >= 0) {
    partes.push(`${numero.format(datos.distanceKm)} km`);
  }
  return partes.length ? partes.join(' · ') : 'Trayecto sin calcular';
}

/**
 * Corrección de los minutos que devuelve el router (punto 3 de SCRUM-22).
 *
 * OSRM calcula el tiempo a velocidad libre: aplica la velocidad legal de cada
 * vía y no modela ni el arranque, ni los semáforos, ni el aparcar al llegar.
 * El resultado es un sesgo que no es ruido, sino un gradiente sistemático:
 * se queda corto en ciudad y se pasa en carretera.
 *
 * Calibrado contra 100 centros reales de una convocatoria de Aragón (origen en
 * Zaragoza, tiempos de referencia de Google Maps en hora de entrada):
 *
 *     tramo        ratio real/OSRM
 *     0–5 km            1,43
 *     5–10 km           1,25
 *     10–20 km          1,08
 *     20–40 km          0,95
 *     40–80 km          0,97
 *     80+ km            0,94
 *
 * La recta `4 + 0,90·t` captura ambos extremos y baja el error medio de 4,2 a
 * 2,5 minutos. Los dos coeficientes tienen sentido físico: unos 4 minutos fijos
 * de arrancar y aparcar, y una velocidad de crucero un 10 % mayor que la legal.
 *
 * Validación: validación cruzada 5-fold (MAE 2,46, igual que el ajuste, así que
 * no hay sobreajuste) y bootstrap de 2000 muestras (término fijo 3,94 min con
 * IC95 [3,2 – 4,6]; pendiente 0,896 con IC95 [0,88 – 0,92]). Ajustando solo con
 * los trayectos de 10 km o más salen coeficientes casi idénticos (3,27 y 0,904)
 * que predicen los urbanos igual de bien: el modelo generaliza, no memoriza.
 *
 * Ojo al recalibrar: la muestra sale de un único origen urbano. El término fijo
 * es el que más puede moverse para quien vive en un pueblo; la pendiente es la
 * parte sólida. Los kilómetros no se tocan, que ya son los reales por carretera.
 */
export const MINUTOS_FIJOS_TRAYECTO = 4;
export const FACTOR_VELOCIDAD_TRAYECTO = 0.9;

export function corregirMinutosRuta(minutosCrudos: number): number {
  if (!Number.isFinite(minutosCrudos) || minutosCrudos <= 0) return 0;
  return MINUTOS_FIJOS_TRAYECTO + FACTOR_VELOCIDAD_TRAYECTO * minutosCrudos;
}

/**
 * Texto único del aviso. Los minutos son una estimación calibrada, no una
 * medición: quien decide a qué plaza se presenta tiene que saberlo, y tiene que
 * leer lo mismo en la tabla, en el resultado, en la comprobación y en el Excel.
 */
/** Lo que cabe en el chip. La explicación entera va en el `title`. */
export const AVISO_TRAYECTO_CORTO = 'Tiempos aproximados';

export const AVISO_TRAYECTO_APROXIMADO =
  'Los tiempos de trayecto son aproximados: se calculan sin tráfico real y pueden variar según la hora. ' +
  'Estamos trabajando para afinarlos. Los kilómetros sí son los reales por carretera.';

/**
 * Clave con la que se cruzan los trayectos entre el navegador y la API.
 *
 * Las rutas se calculan por centro, no por vacante: dos plazas del mismo
 * instituto tienen el mismo trayecto. Y el centro es además lo único que ambos
 * lados nombran igual — las vacantes que el navegador saca del PDF se llaman
 * `ara-<numero>` y las de la base de datos llevan su propio cuid, así que
 * cruzarlas por id no casaba ninguna y todas las plazas salían "sin calcular".
 *
 * Se normaliza a 8 dígitos por si alguna fuente pierde el cero de la izquierda:
 * una clave que no case deja la plaza sin trayecto y sin explicar por qué.
 */
export function claveCentroTrayecto(centerCode?: string | null): string | undefined {
  const limpio = (centerCode ?? '').trim();
  return limpio ? limpio.padStart(8, '0') : undefined;
}
