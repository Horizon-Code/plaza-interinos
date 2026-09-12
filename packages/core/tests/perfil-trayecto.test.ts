import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  DynamicConditionRule,
  dailyTravelCostEur,
  evaluateVacancy,
  resolveTravelLimit,
  type UserProfile,
  type Vacancy
} from '../src/index.js';

const vacante = (overrides: Partial<Vacancy> = {}): Vacancy => ({
  id: 'v-1',
  source: 'test',
  community: 'aragon',
  municipality: 'Zaragoza',
  bodyCode: '0590',
  specialtyCode: '006',
  workload: 1,
  voluntary: false,
  voluntaryReasonCodes: [],
  requirements: [],
  tags: [],
  latitude: 41.6488,
  longitude: -0.8891,
  parsedAt: new Date().toISOString(),
  ...overrides
});

const perfil = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'p-1',
  name: 'Perfil',
  homeLocation: { municipality: 'Zaragoza', latitude: 41.6295, longitude: -0.8892 },
  specialties: [{ bodyCode: '0590', specialtyCode: '006' }],
  acceptsPartialWorkload: true,
  acceptsVoluntary: true,
  acceptsAfternoon: true,
  acceptsItinerant: true,
  acceptsBilingual: true,
  acceptsLongTerm: true,
  acceptedLanguages: ['en', 'fr'],
  excludedPrograms: [],
  excludedTags: [],
  preferredMunicipalities: [],
  excludedMunicipalities: [],
  preferredCenters: [],
  excludedCenters: [],
  rankingWeights: DEFAULT_WEIGHTS,
  ...overrides
});

describe('resolveTravelLimit', () => {
  it('sin travelMode aplica los límites legados', () => {
    const { limit } = resolveTravelLimit(perfil({ maxTravelMinutes: 45, maxDistanceKm: 60 }), vacante());
    expect(limit).toEqual({ maxKm: 60, maxMinutes: 45 });
  });

  it('modo km ignora el límite de minutos', () => {
    const { limit } = resolveTravelLimit(
      perfil({ travelMode: 'km', maxDistanceKm: 60, maxTravelMinutes: 45 }),
      vacante()
    );
    expect(limit.maxKm).toBe(60);
    expect(limit.maxMinutes).toBeUndefined();
  });

  it('el tramo de jornada aplicable sustituye al límite base', () => {
    const p = perfil({
      travelMode: 'minutes',
      maxTravelMinutes: 30,
      workloadTravelTiers: [
        { minWorkload: 0.5, limit: { maxMinutes: 40 } },
        { minWorkload: 0.9, limit: { maxMinutes: 60 } }
      ]
    });
    expect(resolveTravelLimit(p, vacante({ workload: 1 })).limit.maxMinutes).toBe(60);
    expect(resolveTravelLimit(p, vacante({ workload: 0.66 })).limit.maxMinutes).toBe(40);
    // Por debajo del tramo más bajo, el límite base.
    expect(resolveTravelLimit(p, vacante({ workload: 0.33 })).limit.maxMinutes).toBe(30);
    // Jornada desconocida → límite base.
    expect(resolveTravelLimit(p, vacante({ workload: undefined })).limit.maxMinutes).toBe(30);
  });

  it('el límite por condición recorta al mínimo', () => {
    const p = perfil({
      travelMode: 'minutes',
      maxTravelMinutes: 60,
      conditionTravelLimits: { afternoon: { maxMinutes: 20 } }
    });
    const conTarde = resolveTravelLimit(p, vacante({ tags: ['afternoon'] }));
    expect(conTarde.limit.maxMinutes).toBe(20);
    expect(conTarde.source).toContain('afternoon');
    expect(resolveTravelLimit(p, vacante()).limit.maxMinutes).toBe(60);
  });

  it('un límite por condición mayor que el vigente no lo amplía', () => {
    const p = perfil({
      travelMode: 'minutes',
      maxTravelMinutes: 30,
      conditionTravelLimits: { afternoon: { maxMinutes: 90 } }
    });
    expect(resolveTravelLimit(p, vacante({ tags: ['afternoon'] })).limit.maxMinutes).toBe(30);
  });
});

describe('evaluateVacancy con límites nuevos y coste', () => {
  // Zaragoza → Huesca ≈ 68 km de carretera con el estimador por defecto.
  const huesca = vacante({ latitude: 42.14, longitude: -0.408 });

  it('excluye por tramo de jornada y el mensaje nombra el origen', () => {
    const p = perfil({
      travelMode: 'minutes',
      maxTravelMinutes: 999,
      workloadTravelTiers: [{ minWorkload: 0.9, limit: { maxMinutes: 10 } }]
    });
    const e = evaluateVacancy(huesca, p);
    expect(e.included).toBe(false);
    const razon = e.hardExclusionReasons.find(r => r.reasonCode === 'travel-time-exceeded');
    expect(razon?.message).toContain('jornadas ≥ 90%');
  });

  it('calcula el coste diario ida y vuelta con el coche del perfil', () => {
    const p = perfil({
      car: { fuelType: 'diesel', consumptionLper100: 6, fuelPricePerLiter: 1.5 }
    });
    const e = evaluateVacancy(huesca, p);
    expect(e.dailyCostEur).toBeGreaterThan(5);
    expect(e.dailyCostEur).toBeCloseTo(e.distanceKm! * 2 * 0.06 * 1.5, 1);
  });

  it('sin coche no hay coste y no falla', () => {
    expect(evaluateVacancy(huesca, perfil()).dailyCostEur).toBeUndefined();
  });

  it('usa el precio de opciones si el coche no trae precio propio', () => {
    const p = perfil({ car: { fuelType: 'gasolina', consumptionLper100: 5 } });
    const e = evaluateVacancy(huesca, p, { fuelPricePerLiter: 1.6 });
    expect(e.dailyCostEur).toBeCloseTo(e.distanceKm! * 2 * 0.05 * 1.6, 1);
  });
});

describe('dailyTravelCostEur', () => {
  it('50 km, 6 l/100, 1.50 €/l → 9 € ida y vuelta', () => {
    expect(dailyTravelCostEur(50, 6, 1.5)).toBe(9);
  });
});

describe('DynamicConditionRule', () => {
  const regla = new DynamicConditionRule();
  const reqAsignatura = {
    code: 'asignatura:economia',
    label: 'Con horas de Economía',
    category: 'asignatura' as const,
    required: true,
    confidence: 0.75
  };

  it('condición rechazada → fail', () => {
    const r = regla.evaluate(
      vacante({ requirements: [reqAsignatura], voluntary: true }),
      perfil({ conditionAccepts: { 'asignatura:economia': false } })
    );
    expect(r.status).toBe('fail');
  });

  it('condición aceptada → pass positivo', () => {
    const r = regla.evaluate(
      vacante({ requirements: [reqAsignatura], voluntary: true }),
      perfil({ conditionAccepts: { 'asignatura:economia': true } })
    );
    expect(r.status).toBe('pass');
    expect(r.positive).toBe(true);
  });

  it('condición sin decidir → warning (revisión manual)', () => {
    const r = regla.evaluate(vacante({ requirements: [reqAsignatura], voluntary: true }), perfil());
    expect(r.status).toBe('warning');
    expect(r.reasonCode).toBe('condition-unknown');
  });

  it('no reevalúa lo que cubren las reglas legadas (idiomas, programas)', () => {
    const reqIdioma = { code: 'en', label: 'Inglés', category: 'language' as const, required: true, confidence: 0.95 };
    const reqPrograma = { code: 'pai', label: 'PAI', category: 'program' as const, required: true, confidence: 0.9 };
    const r = regla.evaluate(
      vacante({ requirements: [reqIdioma, reqPrograma], voluntary: true }),
      perfil()
    );
    expect(r.status).toBe('pass');
    expect(r.reasonCode).toBe('no-dynamic-conditions');
  });

  it('una plaza obligatoria no se filtra por sus condiciones', () => {
    // Aunque el perfil rechace la condición, la plaza obligatoria entra igual:
    // sus condiciones solo pesan en el orden.
    const r = regla.evaluate(
      vacante({ requirements: [reqAsignatura], voluntary: false }),
      perfil({ conditionAccepts: { 'asignatura:economia': false } })
    );
    expect(r.status).toBe('pass');
    expect(r.reasonCode).toBe('condition-mandatory');
  });
});

describe('Bandas trayecto → jornada', () => {
  // El centro de prueba queda a unos 2 km del domicilio.
  const conBanda = (minWorkload: number, maxWorkload: number) =>
    perfil({
      travelMode: 'km',
      travelWorkloadBands: [{ fromTravel: 0, toTravel: 10, minWorkload, maxWorkload }]
    });

  it('descarta una jornada por debajo del mínimo de su banda', () => {
    const r = evaluateVacancy(vacante({ workload: 0.5 }), conBanda(0.8, 1));
    expect(r.included).toBe(false);
    expect(r.hardExclusionReasons.some(x => x.reasonCode === 'workload-band-mismatch')).toBe(true);
  });

  it('descarta una jornada por encima del máximo de su banda', () => {
    const r = evaluateVacancy(vacante({ workload: 1 }), conBanda(0, 0.5));
    expect(r.included).toBe(false);
    expect(r.hardExclusionReasons.some(x => x.reasonCode === 'workload-band-mismatch')).toBe(true);
  });

  it('acepta una jornada dentro de su banda', () => {
    const r = evaluateVacancy(vacante({ workload: 0.9 }), conBanda(0.8, 1));
    expect(r.hardExclusionReasons.some(x => x.reasonCode === 'workload-band-mismatch')).toBe(false);
  });

  it('un trayecto fuera de toda banda no se filtra por jornada', () => {
    const p = perfil({
      travelMode: 'km',
      travelWorkloadBands: [{ fromTravel: 50, toTravel: 100, minWorkload: 1, maxWorkload: 1 }]
    });
    const r = evaluateVacancy(vacante({ workload: 0.25 }), p);
    expect(r.hardExclusionReasons.some(x => x.reasonCode === 'workload-band-mismatch')).toBe(false);
  });
});

describe('rutas de carretera ausentes o inválidas', () => {
  it('una banda de jornada necesita revisión aunque no haya máximo general', () => {
    const e = evaluateVacancy(vacante(), perfil({
      travelWorkloadBands: [{ fromTravel: 0, toTravel: 45, minWorkload: 0.5, maxWorkload: 1 }]
    }), { travelEstimator: { estimate: () => undefined } });
    expect(e.distanceKm).toBeUndefined();
    expect(e.travelMinutes).toBeUndefined();
    expect(e.requiresManualReview).toBe(true);
    expect(e.warnings.some(w => w.reasonCode === 'distance-unknown')).toBe(true);
  });

  it('no filtra ni calcula combustible con rutas inválidas', () => {
    const e = evaluateVacancy(vacante(), perfil({ maxTravelMinutes: 45,
      car: { fuelType: 'gasolina', consumptionLper100: 6, fuelPricePerLiter: 1.5 }
    }), { travelEstimator: { estimate: () => ({ distanceKm: NaN, travelMinutes: -1 }) } });
    expect(e.distanceKm).toBeUndefined();
    expect(e.dailyCostEur).toBeUndefined();
    expect(e.requiresManualReview).toBe(true);
  });
});
