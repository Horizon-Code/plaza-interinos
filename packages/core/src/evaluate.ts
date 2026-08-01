import type {
  EvaluationReason,
  TravelLimit,
  UserProfile,
  Vacancy,
  VacancyEvaluation,
  VacancyRule
} from './models.js';
import { ALL_RULES } from './rules/index.js';
import { MANUAL_REVIEW_CONFIDENCE } from './tags.js';

/**
 * Distancia Haversine en km. Proveedor de rutas intercambiable (sección 10.1):
 * este es el fallback sin dependencias; sustituir por OpenRouteService o
 * Google Maps implementando TravelEstimator.
 */
export function haversineKm(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface TravelEstimate {
  distanceKm: number;
  travelMinutes: number;
}

export interface TravelEstimator {
  estimate(profile: UserProfile, vacancy: Vacancy): TravelEstimate | undefined;
}

/** Estimador por defecto: Haversine × 1.3 de factor de carretera, 55 km/h medios. */
export class HaversineEstimator implements TravelEstimator {
  estimate(profile: UserProfile, vacancy: Vacancy): TravelEstimate | undefined {
    const { latitude: hLat, longitude: hLon } = profile.homeLocation;
    if (hLat == null || hLon == null || vacancy.latitude == null || vacancy.longitude == null) {
      return undefined;
    }
    const straight = haversineKm(hLat, hLon, vacancy.latitude, vacancy.longitude);
    const roadKm = straight * 1.3;
    return {
      distanceKm: Math.round(roadKm * 10) / 10,
      travelMinutes: Math.round((roadKm / 55) * 60)
    };
  }
}

export interface EvaluateOptions {
  rules?: VacancyRule[];
  travelEstimator?: TravelEstimator;
  /** €/litro a aplicar si el perfil tiene coche sin precio propio. */
  fuelPricePerLiter?: number;
}

export interface ResolvedTravelLimit {
  limit: TravelLimit;
  /** Descripción del origen del límite, para el mensaje de exclusión. */
  source: string;
}

/**
 * Resuelve el límite de trayecto aplicable a una vacante concreta:
 *  1. Límite base del perfil (minutos o km según travelMode).
 *  2. Si hay tramos por jornada, el tramo de mayor minWorkload ≤ workload lo sustituye.
 *  3. Los límites por condición (tags presentes en la vacante) recortan al mínimo.
 */
export function resolveTravelLimit(profile: UserProfile, vacancy: Vacancy): ResolvedTravelLimit {
  // Sin travelMode (perfiles antiguos) aplican ambos límites; con él, solo el del modo.
  let limit: TravelLimit =
    profile.travelMode === 'km'
      ? { maxKm: profile.maxDistanceKm }
      : profile.travelMode === 'minutes'
        ? { maxMinutes: profile.maxTravelMinutes }
        : { maxKm: profile.maxDistanceKm, maxMinutes: profile.maxTravelMinutes };
  let source = 'tu límite general';

  if (vacancy.workload != null && profile.workloadTravelTiers?.length) {
    const aplicable = [...profile.workloadTravelTiers]
      .filter(t => t.minWorkload <= vacancy.workload!)
      .sort((a, b) => b.minWorkload - a.minWorkload)[0];
    if (aplicable && (aplicable.limit.maxKm != null || aplicable.limit.maxMinutes != null)) {
      limit = { ...aplicable.limit };
      source = `tu límite para jornadas ≥ ${Math.round(aplicable.minWorkload * 100)}%`;
    }
  }

  if (profile.conditionTravelLimits) {
    for (const tag of vacancy.tags) {
      const porCondicion = profile.conditionTravelLimits[tag];
      if (!porCondicion) continue;
      if (porCondicion.maxMinutes != null && (limit.maxMinutes == null || porCondicion.maxMinutes < limit.maxMinutes)) {
        limit = { ...limit, maxMinutes: porCondicion.maxMinutes };
        source = `tu límite para la condición "${tag}"`;
      }
      if (porCondicion.maxKm != null && (limit.maxKm == null || porCondicion.maxKm < limit.maxKm)) {
        limit = { ...limit, maxKm: porCondicion.maxKm };
        source = `tu límite para la condición "${tag}"`;
      }
    }
  }

  return { limit, source };
}

/** Coste aproximado del trayecto en coche, ida y vuelta (€/día). */
export function dailyTravelCostEur(
  distanceKm: number,
  consumptionLper100: number,
  pricePerLiter: number
): number {
  return Math.round(distanceKm * 2 * (consumptionLper100 / 100) * pricePerLiter * 100) / 100;
}

export function evaluateVacancy(
  vacancy: Vacancy,
  profile: UserProfile,
  options: EvaluateOptions = {}
): VacancyEvaluation {
  const rules = options.rules ?? ALL_RULES;
  const estimator = options.travelEstimator ?? new HaversineEstimator();

  const hardExclusionReasons: EvaluationReason[] = [];
  const warnings: EvaluationReason[] = [];
  const positiveReasons: EvaluationReason[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(vacancy, profile);
    const reason: EvaluationReason = {
      ruleId: rule.id,
      reasonCode: result.reasonCode,
      message: result.message,
      sourceText: result.sourceText
    };
    if (result.status === 'fail') hardExclusionReasons.push(reason);
    else if (result.status === 'warning') warnings.push(reason);
    else if (result.positive) positiveReasons.push(reason);
  }

  const travel = estimator.estimate(profile, vacancy);
  const { limit, source } = resolveTravelLimit(profile, vacancy);
  const hayLimite =
    limit.maxKm != null ||
    limit.maxMinutes != null ||
    profile.maxDistanceKm != null ||
    profile.maxTravelMinutes != null;
  if (travel) {
    if (limit.maxKm != null && travel.distanceKm > limit.maxKm) {
      hardExclusionReasons.push({
        ruleId: 'distance',
        reasonCode: 'distance-exceeded',
        message: `A ${travel.distanceKm} km, por encima de ${source} (${limit.maxKm} km).`
      });
    } else if (limit.maxMinutes != null && travel.travelMinutes > limit.maxMinutes) {
      hardExclusionReasons.push({
        ruleId: 'distance',
        reasonCode: 'travel-time-exceeded',
        message: `Unos ${travel.travelMinutes} min de trayecto, por encima de ${source} (${limit.maxMinutes} min).`
      });
    }
  } else if (hayLimite) {
    warnings.push({
      ruleId: 'distance',
      reasonCode: 'distance-unknown',
      message: 'No se ha podido calcular la distancia: faltan coordenadas del centro o de tu domicilio.'
    });
  }

  // Bandas trayecto → jornada: es la distancia la que decide qué jornada compensa.
  if (travel && vacancy.workload != null && profile.travelWorkloadBands?.length) {
    const unidad = profile.travelMode === 'km' ? 'km' : 'min';
    const recorrido = profile.travelMode === 'km' ? travel.distanceKm : travel.travelMinutes;
    const banda = profile.travelWorkloadBands.find(
      b => recorrido >= b.fromTravel && recorrido <= b.toTravel
    );
    if (banda && (vacancy.workload < banda.minWorkload || vacancy.workload > banda.maxWorkload)) {
      hardExclusionReasons.push({
        ruleId: 'workload-band',
        reasonCode: 'workload-band-mismatch',
        message:
          `Jornada del ${Math.round(vacancy.workload * 100)}% a ${recorrido} ${unidad} de casa: ` +
          `fuera del ${Math.round(banda.minWorkload * 100)}–${Math.round(banda.maxWorkload * 100)}% ` +
          `que aceptas para ese trayecto.`
      });
    }
  }

  let dailyCostEur: number | undefined;
  const precio = profile.car?.fuelPricePerLiter ?? options.fuelPricePerLiter;
  if (travel && profile.car && precio != null) {
    dailyCostEur = dailyTravelCostEur(travel.distanceKm, profile.car.consumptionLper100, precio);
  }

  const requiresManualReview =
    vacancy.requirements.some(r => r.confidence < MANUAL_REVIEW_CONFIDENCE) ||
    warnings.some(w => w.reasonCode.endsWith('-unknown') || w.reasonCode.endsWith('-ambiguous'));

  return {
    vacancyId: vacancy.id,
    included: hardExclusionReasons.length === 0,
    score: 0,
    hardExclusionReasons,
    warnings,
    positiveReasons,
    distanceKm: travel?.distanceKm,
    travelMinutes: travel?.travelMinutes,
    dailyCostEur,
    requiresManualReview
  };
}
