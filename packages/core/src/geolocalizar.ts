import { CENTROS_ARAGON, type CentroGeolocalizado } from './catalog/centros-aragon.js';

/**
 * Geolocalización de vacantes (punto 5 de la especificación).
 *
 * El PDF oficial no trae coordenadas, pero sí el código de centro de 8 dígitos.
 * Cruzándolo con el catálogo de IDEAragón rellenamos latitude/longitude, que es
 * lo único que le falta a `HaversineEstimator` para dar distancia, tiempo y
 * coste €/día.
 *
 * Un centro sin cruce se queda a `undefined` a propósito: la vacante aparecerá
 * como "distancia sin calcular" y caerá a revisión manual. Nunca inventamos una
 * coordenada aproximada, porque una distancia falsa es peor que ninguna.
 */

export function coordenadasDeCentro(centerCode?: string): CentroGeolocalizado | undefined {
  if (!centerCode) return undefined;
  return CENTROS_ARAGON[centerCode.trim().padStart(8, '0')];
}

export interface VacanteGeolocalizable {
  centerCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface ResumenGeolocalizacion {
  total: number;
  conCoordenadas: number;
  /** Códigos de centro que no están en el catálogo, para poder revisarlos. */
  centrosSinCruce: string[];
}

/**
 * Rellena las coordenadas que falten, en el sitio. Respeta las que ya vengan
 * dadas: si la fuente aporta coordenadas propias, mandan sobre el catálogo.
 */
export function geolocalizarVacantes<T extends VacanteGeolocalizable>(
  vacantes: T[]
): ResumenGeolocalizacion {
  const sinCruce = new Set<string>();
  let conCoordenadas = 0;

  for (const vacante of vacantes) {
    if (vacante.latitude != null && vacante.longitude != null) {
      conCoordenadas += 1;
      continue;
    }
    const centro = coordenadasDeCentro(vacante.centerCode);
    if (centro) {
      vacante.latitude = centro.lat;
      vacante.longitude = centro.lng;
      conCoordenadas += 1;
    } else if (vacante.centerCode) {
      sinCruce.add(vacante.centerCode);
    }
  }

  return {
    total: vacantes.length,
    conCoordenadas,
    centrosSinCruce: [...sinCruce].sort()
  };
}
