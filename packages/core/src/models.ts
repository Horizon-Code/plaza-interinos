export type AutonomousCommunity = 'aragon';

export type ScheduleType = 'morning' | 'afternoon' | 'mixed' | 'unknown';

export type DurationType = 'full_course' | 'long_term' | 'substitution' | 'unknown';

export type RequirementCategory =
  | 'language'
  | 'schedule'
  | 'program'
  | 'fp'
  | 'asignatura'
  | 'qualification'
  | 'mobility'
  | 'duration'
  | 'other';

/** Condición agregada sobre una convocatoria importada, para el perfil dinámico. */
export interface DetectedCondition {
  tag: string;
  label: string;
  category: RequirementCategory;
  /** Número de vacantes de la convocatoria que la llevan. */
  count: number;
}

export interface VacancyRequirement {
  code: string;
  label: string;
  category: RequirementCategory;
  required: boolean;
  /** 0..1 — cuanto proviene de texto libre, menor confianza. */
  confidence: number;
  /** Fragmento literal del PDF que originó el requisito. Trazabilidad (riesgo 19.2). */
  sourceText?: string;
}

export interface Vacancy {
  id: string;
  source: string;
  sourceId?: string;

  community: AutonomousCommunity;
  province?: string;
  municipality?: string;

  bodyCode?: string;
  bodyName?: string;
  specialtyCode?: string;
  specialtyName?: string;

  centerCode?: string;
  centerName?: string;
  centerAddress?: string;

  /** 1 = jornada completa, 0.5 = media, 0.33 = tercio... */
  workload?: number;
  scheduleType?: ScheduleType;

  voluntary: boolean;
  voluntaryReasonCodes: string[];

  durationType?: DurationType;
  startDate?: string;
  endDate?: string;

  additionalInfoRaw?: string;
  requirements: VacancyRequirement[];
  tags: string[];

  latitude?: number;
  longitude?: number;

  sourcePage?: number;
  sourceRow?: number;

  parsedAt: string;
}

export interface UserSpecialtyPosition {
  bodyCode: string;
  specialtyCode: string;
  list?: number;
  block?: number;
  blockOrder?: number;
}

export type TravelMode = 'minutes' | 'km';

export interface TravelLimit {
  maxMinutes?: number;
  maxKm?: number;
}

/** "A partir de X de jornada (0..1) acepto hasta este trayecto." */
export interface WorkloadTravelTier {
  minWorkload: number;
  limit: TravelLimit;
}

/**
 * "Para un trayecto de entre `fromTravel` y `toTravel` me compensa una jornada
 * de entre `minWorkload` y `maxWorkload` (0..1)."
 *
 * Invierte el planteamiento de `WorkloadTravelTier`: aquí manda la distancia,
 * que es lo que el docente conoce de antemano, y esta decide qué jornada
 * acepta. La unidad del trayecto la fija `UserProfile.travelMode`.
 */
export interface TravelWorkloadBand {
  fromTravel: number;
  toTravel: number;
  minWorkload: number;
  maxWorkload: number;
}

export interface CarInfo {
  fuelType: 'diesel' | 'gasolina';
  /** Consumo en litros / 100 km. */
  consumptionLper100: number;
  /** €/litro; si falta, se usa el precio medio del momento. */
  fuelPricePerLiter?: number;
}

export interface RankingWeights {
  distance: number;
  travelTime: number;
  workload: number;
  schedule: number;
  center: number;
  municipality: number;
  duration: number;
  specialConditions: number;
}

export interface UserProfile {
  id: string;
  name: string;

  homeLocation: {
    address?: string;
    municipality?: string;
    latitude?: number;
    longitude?: number;
  };

  specialties: UserSpecialtyPosition[];

  maxDistanceKm?: number;
  maxTravelMinutes?: number;

  acceptsPartialWorkload: boolean;
  minimumWorkload?: number;

  acceptsVoluntary: boolean;
  acceptsAfternoon: boolean;
  acceptsItinerant: boolean;
  acceptsBilingual: boolean;
  acceptsLongTerm: boolean;

  acceptedLanguages: string[];
  excludedPrograms: string[];
  excludedTags: string[];

  /** Modo del límite base de trayecto: por minutos o por km. */
  travelMode?: TravelMode;
  /** Tramos "a partir de X% de jornada acepto hasta Y", ordenados por minWorkload. */
  workloadTravelTiers?: WorkloadTravelTier[];
  /** Bandas "a este trayecto le corresponde esta jornada", en la unidad de travelMode. */
  travelWorkloadBands?: TravelWorkloadBand[];
  /** tag → aceptada (true) o rechazada (false); ausente = sin decidir. */
  conditionAccepts?: Record<string, boolean>;
  /** tag → límite de trayecto específico para vacantes con esa condición. */
  conditionTravelLimits?: Record<string, TravelLimit>;
  /** Datos del coche para estimar el coste del trayecto. */
  car?: CarInfo;

  preferredMunicipalities: string[];
  excludedMunicipalities: string[];

  preferredCenters: string[];
  excludedCenters: string[];

  rankingWeights: RankingWeights;
}

export interface EvaluationReason {
  ruleId: string;
  reasonCode: string;
  message: string;
  sourceText?: string;
}

export interface VacancyEvaluation {
  vacancyId: string;
  included: boolean;
  score: number;

  hardExclusionReasons: EvaluationReason[];
  warnings: EvaluationReason[];
  positiveReasons: EvaluationReason[];

  distanceKm?: number;
  travelMinutes?: number;
  /** Coste aproximado del trayecto en coche, ida y vuelta, €/día. */
  dailyCostEur?: number;

  requiresManualReview: boolean;
}

export type RuleStatus = 'pass' | 'fail' | 'warning';

export interface RuleResult {
  status: RuleStatus;
  reasonCode: string;
  message: string;
  /** true si un pass debe contarse como razón positiva en el ranking. */
  positive?: boolean;
  sourceText?: string;
  metadata?: Record<string, unknown>;
}

export interface VacancyRule {
  id: string;
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 1,
  travelTime: 1,
  workload: 0.6,
  schedule: 0.4,
  center: 0.8,
  municipality: 0.8,
  duration: 0.4,
  specialConditions: 0.5
};
