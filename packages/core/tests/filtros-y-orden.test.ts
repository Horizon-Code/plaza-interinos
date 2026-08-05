import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  ORDEN_POR_DEFECTO,
  coordenadasDeCentro,
  evaluateVacancy,
  geolocalizarVacantes,
  moverCriterio,
  ordenarEnCascada,
  type CriterioConfigurado,
  type UserProfile,
  type Vacancy
} from '../src/index.js';

const vacante = (overrides: Partial<Vacancy> = {}): Vacancy => ({
  id: 'v-1',
  source: 'test',
  community: 'aragon',
  municipality: 'Tarazona',
  bodyCode: '0590',
  specialtyCode: '006',
  centerCode: '50010101',
  centerName: 'IES Ejemplo',
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
  name: 'Perfil de prueba',
  homeLocation: { municipality: 'Zaragoza', latitude: 41.6295, longitude: -0.8892 },
  specialties: [{ bodyCode: '0590', specialtyCode: '006', blockOrder: 113 }],
  acceptsPartialWorkload: true,
  acceptsVoluntary: true,
  acceptsAfternoon: true,
  acceptsItinerant: true,
  acceptsBilingual: true,
  acceptsLongTerm: true,
  acceptedLanguages: [],
  excludedPrograms: [],
  excludedTags: [],
  preferredMunicipalities: [],
  excludedMunicipalities: [],
  preferredCenters: [],
  excludedCenters: [],
  rankingWeights: DEFAULT_WEIGHTS,
  ...overrides
});

// ── Punto 1: las obligatorias no se filtran ──────────────────────────────
describe('los filtros de usuario solo descartan voluntarias', () => {
  it('excluir la localidad no saca de la lista una plaza obligatoria', () => {
    const evaluacion = evaluateVacancy(
      vacante({ voluntary: false }),
      perfil({ excludedMunicipalities: ['Tarazona'] })
    );
    expect(evaluacion.included).toBe(true);
    expect(evaluacion.warnings.map(w => w.reasonCode)).toContain('municipality-excluded-obligatoria');
  });

  it('excluir la localidad sí descarta la misma plaza si es voluntaria', () => {
    const evaluacion = evaluateVacancy(
      vacante({ voluntary: true }),
      perfil({ excludedMunicipalities: ['Tarazona'] })
    );
    expect(evaluacion.included).toBe(false);
    expect(evaluacion.hardExclusionReasons.map(r => r.reasonCode)).toContain('municipality-excluded');
  });

  it('excluir el centro no saca de la lista una plaza obligatoria', () => {
    const evaluacion = evaluateVacancy(
      vacante({ voluntary: false }),
      perfil({ excludedCenters: ['50010101'] })
    );
    expect(evaluacion.included).toBe(true);
  });

  it('con localidad y centro excluidos y voluntarias apagadas, la obligatoria sigue dentro', () => {
    const evaluacion = evaluateVacancy(
      vacante({ voluntary: false }),
      perfil({
        acceptsVoluntary: false,
        excludedMunicipalities: ['Tarazona'],
        excludedCenters: ['50010101']
      })
    );
    expect(evaluacion.included).toBe(true);
  });
});

// ── Punto 2: exclusión de centros por código ─────────────────────────────
describe('exclusión de centros (IES)', () => {
  it('descarta la vacante voluntaria del centro excluido', () => {
    const evaluacion = evaluateVacancy(
      vacante({ voluntary: true }),
      perfil({ excludedCenters: ['50010101'] })
    );
    expect(evaluacion.hardExclusionReasons.map(r => r.reasonCode)).toContain('center-excluded');
  });

  it('no descarta un centro distinto del mismo municipio', () => {
    const evaluacion = evaluateVacancy(
      vacante({ voluntary: true, centerCode: '50019999' }),
      perfil({ excludedCenters: ['50010101'] })
    );
    expect(evaluacion.hardExclusionReasons.map(r => r.reasonCode)).not.toContain('center-excluded');
  });
});

// ── Punto 5: coordenadas de los centros ──────────────────────────────────
describe('geolocalización por código de centro', () => {
  it('el catálogo devuelve coordenadas WGS84 dentro de Aragón', () => {
    const centro = coordenadasDeCentro('22004611');
    expect(centro).toBeDefined();
    expect(centro!.lat).toBeGreaterThan(39.8);
    expect(centro!.lat).toBeLessThan(43);
    expect(centro!.lng).toBeGreaterThan(-2.2);
    expect(centro!.lng).toBeLessThan(1);
  });

  it('rellena las vacantes sin coordenadas y respeta las que ya las traen', () => {
    const vacantes = [
      { centerCode: '22004611' },
      { centerCode: '99999999' },
      { centerCode: '22004611', latitude: 1, longitude: 2 }
    ];
    const resumen = geolocalizarVacantes(vacantes);
    expect(vacantes[0].latitude).toBeDefined();
    expect(vacantes[1].latitude).toBeUndefined();
    expect(vacantes[2].latitude).toBe(1);
    expect(resumen.conCoordenadas).toBe(2);
    expect(resumen.centrosSinCruce).toEqual(['99999999']);
  });

  it('una vacante sin coordenadas queda en revisión manual, no con distancia inventada', () => {
    const evaluacion = evaluateVacancy(
      vacante({ latitude: undefined, longitude: undefined }),
      perfil({ maxTravelMinutes: 45 })
    );
    expect(evaluacion.distanceKm).toBeUndefined();
    expect(evaluacion.requiresManualReview).toBe(true);
  });
});

// ── Punto 7: orden en cascada ────────────────────────────────────────────
describe('orden en cascada', () => {
  const fila = (distanceKm: number, specialtyCode: string, workload: number, voluntary: boolean) => ({
    distanceKm,
    vacancy: { bodyCode: '0590', specialtyCode, workload, voluntary }
  });
  const ordenes = { '0590-006': 113, '0590-061': 347 };

  it('por defecto ordena por cercanía', () => {
    const filas = [fila(40, '006', 1, false), fila(10, '006', 1, false)];
    expect(ordenarEnCascada(filas, ORDEN_POR_DEFECTO, ordenes)[0].distanceKm).toBe(10);
  });

  it('el criterio siguiente desempata al anterior', () => {
    const cascada: CriterioConfigurado[] = [
      { criterio: 'specialty', direccion: 'mi-orden-bajo-primero' },
      { criterio: 'distance', direccion: 'cerca-primero' }
    ];
    const filas = [fila(80, '006', 1, false), fila(5, '061', 1, false), fila(30, '006', 1, false)];
    const resultado = ordenarEnCascada(filas, cascada, ordenes);
    // Primero las de la especialidad 006 (orden 113) y, entre ellas, la más cerca.
    expect(resultado.map(f => f.distanceKm)).toEqual([30, 80, 5]);
  });

  it('invertir la dirección invierte solo ese criterio', () => {
    const cascada: CriterioConfigurado[] = [{ criterio: 'distance', direccion: 'lejos-primero' }];
    const filas = [fila(10, '006', 1, false), fila(40, '006', 1, false)];
    expect(ordenarEnCascada(filas, cascada, ordenes)[0].distanceKm).toBe(40);
  });

  it('las vacantes sin distancia cierran la lista aunque el orden esté invertido', () => {
    const cascada: CriterioConfigurado[] = [{ criterio: 'distance', direccion: 'lejos-primero' }];
    const filas = [
      { distanceKm: undefined, vacancy: { workload: 1, voluntary: false } },
      fila(40, '006', 1, false)
    ];
    expect(ordenarEnCascada(filas, cascada, ordenes)[0].distanceKm).toBe(40);
  });

  it('jornada completa primero y obligatoria primero', () => {
    const porJornada: CriterioConfigurado[] = [{ criterio: 'workload', direccion: 'completa-primero' }];
    expect(
      ordenarEnCascada([fila(1, '006', 0.5, false), fila(1, '006', 1, false)], porJornada, ordenes)[0]
        .vacancy.workload
    ).toBe(1);

    const porTipo: CriterioConfigurado[] = [{ criterio: 'voluntary', direccion: 'obligatoria-primero' }];
    expect(
      ordenarEnCascada([fila(1, '006', 1, true), fila(1, '006', 1, false)], porTipo, ordenes)[0]
        .vacancy.voluntary
    ).toBe(false);
  });

  it('mover un criterio recoloca los demás sin dejar huecos ni repetidos', () => {
    const movida = moverCriterio(ORDEN_POR_DEFECTO, 3, 0);
    expect(movida.map(c => c.criterio)).toEqual(['voluntary', 'distance', 'specialty', 'workload']);
    expect(new Set(movida.map(c => c.criterio)).size).toBe(4);
  });
});
