import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  checkSelection,
  evaluateVacancy,
  extractFromAdditionalInfo,
  rankAndGroup,
  type UserProfile,
  type Vacancy
} from '../src/index.js';

const baseVacancy = (overrides: Partial<Vacancy> = {}): Vacancy => ({
  id: 'v-1',
  source: 'test',
  community: 'aragon',
  province: 'Zaragoza',
  municipality: 'Zaragoza',
  bodyCode: '0590',
  specialtyCode: '006',
  specialtyName: 'Matemáticas',
  centerCode: '50010101',
  centerName: 'IES Ejemplo',
  workload: 1,
  scheduleType: 'morning',
  voluntary: false,
  voluntaryReasonCodes: [],
  durationType: 'full_course',
  requirements: [],
  tags: [],
  latitude: 41.6488,
  longitude: -0.8891,
  parsedAt: new Date().toISOString(),
  ...overrides
});

const baseProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'p-1',
  name: 'Perfil de prueba',
  homeLocation: { municipality: 'Zaragoza', latitude: 41.6295, longitude: -0.8892 },
  specialties: [{ bodyCode: '0590', specialtyCode: '006', blockOrder: 187 }],
  maxTravelMinutes: 45,
  acceptsPartialWorkload: true,
  minimumWorkload: 0.5,
  acceptsVoluntary: true,
  acceptsAfternoon: false,
  acceptsItinerant: false,
  acceptsBilingual: false,
  acceptsLongTerm: true,
  acceptedLanguages: [],
  excludedPrograms: ['pai', 'robotics', 'cfg_basica'],
  excludedTags: [],
  preferredMunicipalities: ['Zaragoza'],
  excludedMunicipalities: [],
  preferredCenters: [],
  excludedCenters: [],
  rankingWeights: DEFAULT_WEIGHTS,
  ...overrides
});

describe('extractFromAdditionalInfo', () => {
  it('convierte el ejemplo de la sección 8.4 en etiquetas y requisitos', () => {
    const result = extractFromAdditionalInfo(
      'Programa bilingüe inglés. Horario de tarde. Plaza voluntaria.'
    );
    expect(result.tags).toContain('bilingual_en');
    expect(result.tags).toContain('afternoon');
    expect(result.tags).toContain('voluntary');
    const english = result.requirements.find(r => r.code === 'en');
    expect(english?.required).toBe(true);
    expect(english?.sourceText?.toLowerCase()).toContain('bilingüe inglés');
  });

  it('marca baja confianza cuando el bilingüismo no especifica idioma', () => {
    const result = extractFromAdditionalInfo('Centro con programa bilingüe.');
    const req = result.requirements.find(r => r.code === 'lang_unknown');
    expect(req).toBeDefined();
    expect(req!.confidence).toBeLessThan(0.7);
  });

  it('devuelve vacío ante texto vacío', () => {
    expect(extractFromAdditionalInfo(undefined).tags).toHaveLength(0);
  });
});

describe('evaluateVacancy', () => {
  it('excluye una plaza con inglés cuando el perfil lo excluye, con texto fuente', () => {
    const extraction = extractFromAdditionalInfo('Programa bilingüe inglés.');
    const vacancy = baseVacancy({ requirements: extraction.requirements, tags: extraction.tags });
    const evaluation = evaluateVacancy(vacancy, baseProfile());
    expect(evaluation.included).toBe(false);
    const reason = evaluation.hardExclusionReasons.find(r => r.reasonCode === 'language-excluded');
    expect(reason?.sourceText?.toLowerCase()).toContain('bilingüe inglés');
  });

  it('excluye horario de tarde cuando el perfil no lo acepta', () => {
    const vacancy = baseVacancy({ scheduleType: 'afternoon' });
    const evaluation = evaluateVacancy(vacancy, baseProfile());
    expect(evaluation.included).toBe(false);
    expect(evaluation.hardExclusionReasons.some(r => r.reasonCode === 'afternoon-excluded')).toBe(true);
  });

  it('acepta media jornada con advertencia cuando el perfil las admite', () => {
    const vacancy = baseVacancy({ workload: 0.5 });
    const evaluation = evaluateVacancy(vacancy, baseProfile());
    expect(evaluation.included).toBe(true);
    expect(evaluation.warnings.some(w => w.reasonCode === 'partial-accepted')).toBe(true);
  });

  it('excluye por especialidad distinta', () => {
    const vacancy = baseVacancy({ specialtyCode: '011', specialtyName: 'Inglés' });
    const evaluation = evaluateVacancy(vacancy, baseProfile());
    expect(evaluation.included).toBe(false);
  });

  it('excluye por tiempo de trayecto superior al máximo', () => {
    const teruel = baseVacancy({ municipality: 'Teruel', latitude: 40.3456, longitude: -1.1065 });
    const evaluation = evaluateVacancy(teruel, baseProfile());
    expect(evaluation.included).toBe(false);
    expect(evaluation.hardExclusionReasons.some(r => r.reasonCode === 'travel-time-exceeded')).toBe(true);
  });

  it('pide revisión manual cuando hay requisitos de baja confianza', () => {
    const extraction = extractFromAdditionalInfo('Centro bilingüe.');
    const vacancy = baseVacancy({ requirements: extraction.requirements, tags: extraction.tags });
    const evaluation = evaluateVacancy(vacancy, baseProfile({ acceptedLanguages: ['en', 'fr'] }));
    expect(evaluation.requiresManualReview).toBe(true);
  });
});

describe('rankAndGroup', () => {
  it('ordena por cercanía y separa los tres bloques', () => {
    const near = baseVacancy({ id: 'near' });
    const far = baseVacancy({ id: 'far', latitude: 41.68, longitude: -0.95 });
    const partial = baseVacancy({ id: 'partial', workload: 0.5 });
    const english = baseVacancy({
      id: 'english',
      requirements: extractFromAdditionalInfo('Programa bilingüe inglés.').requirements
    });
    const profile = baseProfile();
    const evaluations = [far, near, partial, english].map(v => evaluateVacancy(v, profile));
    const groups = rankAndGroup(evaluations, profile.rankingWeights);

    expect(groups.recommended.map(e => e.vacancyId)).toEqual(['near', 'far']);
    expect(groups.withWarnings.map(e => e.vacancyId)).toEqual(['partial']);
    expect(groups.excluded.map(e => e.vacancyId)).toEqual(['english']);
  });
});

describe('checkSelection', () => {
  it('detecta plazas que faltan y plazas seleccionadas indebidamente', () => {
    const good = evaluateVacancy(baseVacancy({ id: 'good' }), baseProfile());
    const bad = evaluateVacancy(
      baseVacancy({ id: 'bad', scheduleType: 'afternoon' }),
      baseProfile()
    );
    const check = checkSelection([good, bad], ['bad']);
    expect(check.missingCompatible.map(e => e.vacancyId)).toEqual(['good']);
    expect(check.selectedButExcluded.map(e => e.vacancyId)).toEqual(['bad']);
  });
});
