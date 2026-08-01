import type { RuleResult, UserProfile, Vacancy, VacancyRule } from '../models.js';

/**
 * Motor de reglas (sección 12). Cada regla devuelve pass/fail/warning con
 * un código y un mensaje en castellano listo para mostrar al usuario.
 * fail = exclusión dura. warning = compatible pero conviene saberlo.
 */

const pass = (reasonCode: string, message: string, positive = false, sourceText?: string): RuleResult => ({
  status: 'pass',
  reasonCode,
  message,
  positive,
  sourceText
});
const fail = (reasonCode: string, message: string, sourceText?: string): RuleResult => ({
  status: 'fail',
  reasonCode,
  message,
  sourceText
});
const warn = (reasonCode: string, message: string, sourceText?: string): RuleResult => ({
  status: 'warning',
  reasonCode,
  message,
  sourceText
});

function requirementSource(vacancy: Vacancy, code: string): string | undefined {
  return vacancy.requirements.find(r => r.code === code)?.sourceText;
}

export class SpecialtyMatchRule implements VacancyRule {
  readonly id = 'specialty-match';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    if (!vacancy.specialtyCode) {
      return warn('specialty-unknown', 'No se ha podido identificar la especialidad de la plaza.');
    }
    const match = profile.specialties.some(
      s => s.specialtyCode === vacancy.specialtyCode && (!vacancy.bodyCode || s.bodyCode === vacancy.bodyCode)
    );
    return match
      ? pass('specialty-match', 'La plaza corresponde a una de tus especialidades.')
      : fail('specialty-mismatch', 'La plaza es de otra especialidad.');
  }
}

export class LanguageRequirementRule implements VacancyRule {
  readonly id = 'language-requirement';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    const langReq = vacancy.requirements.find(r => r.category === 'language' && r.required);
    if (!langReq) return pass('no-language-required', 'La plaza no exige requisito de idioma.');
    if (langReq.code === 'lang_unknown') {
      return warn(
        'language-ambiguous',
        'Consta un programa bilingüe sin idioma claro. Revisa la información adicional.',
        langReq.sourceText
      );
    }
    if (profile.acceptedLanguages.includes(langReq.code)) {
      return pass('language-accepted', `La plaza exige ${langReq.label.toLowerCase()} y tu perfil lo acepta.`);
    }
    return fail('language-excluded', `${langReq.label} y tu perfil lo excluye.`, langReq.sourceText);
  }
}

export class AfternoonScheduleRule implements VacancyRule {
  readonly id = 'afternoon-schedule';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    const afternoon = vacancy.scheduleType === 'afternoon' || vacancy.tags.includes('afternoon');
    if (!afternoon) return pass('not-afternoon', 'No consta horario de tarde.');
    const src = requirementSource(vacancy, 'afternoon');
    return profile.acceptsAfternoon
      ? warn('afternoon-accepted', 'La plaza tiene horario de tarde.', src)
      : fail('afternoon-excluded', 'La plaza tiene horario de tarde y tu perfil lo excluye.', src);
  }
}

export class ExcludedProgramRule implements VacancyRule {
  readonly id = 'excluded-program';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    const programReqs = vacancy.requirements.filter(r => r.category === 'program');
    for (const req of programReqs) {
      if (profile.excludedPrograms.includes(req.code)) {
        return fail('program-excluded', `${req.label} y tu perfil lo excluye.`, req.sourceText);
      }
    }
    for (const tag of vacancy.tags) {
      if (profile.excludedTags.includes(tag)) {
        return fail('tag-excluded', `La plaza tiene la condición "${tag}" que tu perfil excluye.`);
      }
    }
    if (programReqs.length > 0) {
      return warn(
        'program-present',
        `La plaza está ligada a un programa (${programReqs.map(r => r.label).join(', ')}).`,
        programReqs[0].sourceText
      );
    }
    return pass('no-excluded-program', 'La plaza no tiene programas que excluyas.');
  }
}

export class WorkloadRule implements VacancyRule {
  readonly id = 'workload';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    if (vacancy.workload == null) {
      return warn('workload-unknown', 'No consta la jornada de la plaza.');
    }
    if (vacancy.workload >= 1) return pass('full-workload', 'Jornada completa.', true);
    if (!profile.acceptsPartialWorkload) {
      return fail('partial-excluded', 'Jornada parcial y tu perfil solo acepta jornada completa.');
    }
    if (profile.minimumWorkload != null && vacancy.workload < profile.minimumWorkload) {
      return fail(
        'workload-below-minimum',
        `Jornada de ${Math.round(vacancy.workload * 100)}%, por debajo de tu mínimo (${Math.round(profile.minimumWorkload * 100)}%).`
      );
    }
    return warn('partial-accepted', `Jornada parcial (${Math.round(vacancy.workload * 100)}%).`);
  }
}

export class VoluntaryRule implements VacancyRule {
  readonly id = 'voluntary';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    if (!vacancy.voluntary) return pass('not-voluntary', 'Plaza de adjudicación ordinaria.');
    if (!profile.acceptsVoluntary) {
      return fail('voluntary-excluded', 'Plaza voluntaria y tu perfil las excluye.');
    }
    const reasons = vacancy.voluntaryReasonCodes.length
      ? ` Motivo: ${vacancy.voluntaryReasonCodes.join(', ')}.`
      : ' Motivo no identificado: revisa la información adicional.';
    return warn('voluntary-accepted', `Plaza voluntaria.${reasons}`);
  }
}

export class ItinerantRule implements VacancyRule {
  readonly id = 'itinerant';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    if (!vacancy.tags.includes('itinerant')) return pass('not-itinerant', 'No consta itinerancia.');
    const src = requirementSource(vacancy, 'itinerant');
    return profile.acceptsItinerant
      ? warn('itinerant-accepted', 'Plaza itinerante entre centros.', src)
      : fail('itinerant-excluded', 'Plaza itinerante y tu perfil lo excluye.', src);
  }
}

export class LongTermRule implements VacancyRule {
  readonly id = 'long-term';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    const longTerm = vacancy.durationType === 'long_term' || vacancy.tags.includes('long_term');
    if (!longTerm) return pass('not-long-term', 'No consta larga duración.');
    const src = requirementSource(vacancy, 'long_term');
    return profile.acceptsLongTerm
      ? pass('long-term-accepted', 'Plaza de larga duración.', true, src)
      : fail('long-term-excluded', 'Plaza de larga duración y tu perfil las excluye.', src);
  }
}

export class MunicipalityRule implements VacancyRule {
  readonly id = 'municipality';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    const muni = (vacancy.municipality ?? '').toLowerCase();
    if (!muni) return warn('municipality-unknown', 'No consta la localidad de la plaza.');
    if (profile.excludedMunicipalities.some(m => m.toLowerCase() === muni)) {
      return fail('municipality-excluded', `Localidad excluida por tu perfil (${vacancy.municipality}).`);
    }
    if (profile.preferredMunicipalities.some(m => m.toLowerCase() === muni)) {
      return pass('municipality-preferred', `Localidad preferida (${vacancy.municipality}).`, true);
    }
    return pass('municipality-neutral', `Localidad: ${vacancy.municipality}.`);
  }
}

export class CenterRule implements VacancyRule {
  readonly id = 'center';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    const code = vacancy.centerCode ?? '';
    const name = (vacancy.centerName ?? '').toLowerCase();
    const inList = (list: string[]) =>
      list.some(c => c === code || c.toLowerCase() === name);
    if (inList(profile.excludedCenters)) {
      return fail('center-excluded', `Centro excluido por tu perfil (${vacancy.centerName}).`);
    }
    if (inList(profile.preferredCenters)) {
      return pass('center-preferred', `Centro favorito (${vacancy.centerName}).`, true);
    }
    return pass('center-neutral', 'Centro sin preferencia registrada.');
  }
}

/**
 * Requisitos cuyo tratamiento ya cubren las reglas legadas de arriba; la regla
 * dinámica no debe evaluarlos dos veces.
 */
const CODES_CUBIERTOS_POR_REGLAS_LEGADAS = new Set([
  'en', 'fr', 'lang_unknown', // LanguageRequirementRule (toda la categoría language)
  'afternoon',                 // AfternoonScheduleRule
  'itinerant',                 // ItinerantRule
  'long_term'                  // LongTermRule
]);

/**
 * Condiciones detectadas dinámicamente en la información adicional
 * (asignaturas, FP, perfilada, entrevista, movilidad nueva...). El perfil las
 * acepta o rechaza vía conditionAccepts; sin decisión → aviso con revisión.
 */
export class DynamicConditionRule implements VacancyRule {
  readonly id = 'dynamic-condition';
  evaluate(vacancy: Vacancy, profile: UserProfile): RuleResult {
    // Las plazas obligatorias no se filtran por sus condiciones: entran en la
    // lista igual y sus condiciones solo pesan en el orden. Únicamente las
    // voluntarias son descartables, que es donde el docente decide.
    if (!vacancy.voluntary) {
      return pass('condition-mandatory', 'Plaza obligatoria: sus condiciones ordenan, no descartan.');
    }
    const accepts = profile.conditionAccepts ?? {};
    const pendientes: string[] = [];
    let positivas = 0;
    for (const req of vacancy.requirements) {
      if (!req.required) continue;
      if (CODES_CUBIERTOS_POR_REGLAS_LEGADAS.has(req.code)) continue;
      if (req.category === 'language' || req.category === 'program') continue; // reglas legadas
      const decision = accepts[req.code];
      if (decision === false) {
        return fail('condition-rejected', `${req.label} y tu perfil lo excluye.`, req.sourceText);
      }
      if (decision === undefined) pendientes.push(req.label);
      else positivas += 1;
    }
    if (pendientes.length) {
      return warn(
        'condition-unknown',
        `Condiciones sin decidir en tu perfil: ${pendientes.join(', ')}.`
      );
    }
    if (positivas > 0) {
      return pass('conditions-accepted', 'Las condiciones de la plaza encajan con tu perfil.', true);
    }
    return pass('no-dynamic-conditions', 'La plaza no tiene condiciones adicionales.');
  }
}

export const ALL_RULES: VacancyRule[] = [
  new SpecialtyMatchRule(),
  new LanguageRequirementRule(),
  new AfternoonScheduleRule(),
  new ExcludedProgramRule(),
  new WorkloadRule(),
  new VoluntaryRule(),
  new ItinerantRule(),
  new LongTermRule(),
  new MunicipalityRule(),
  new CenterRule(),
  new DynamicConditionRule()
];
