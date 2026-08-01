import type { VacancyEvaluation } from './models.js';

/**
 * Comprobación antes de enviar (pantallas 5 y sección 8.8):
 * - compatibles no seleccionadas (se te escapa una plaza buena);
 * - seleccionadas pero excluidas por tu perfil (posible error grave);
 * - seleccionadas con información ambigua (conviene leer antes de enviar).
 */
export interface SelectionCheck {
  missingCompatible: VacancyEvaluation[];
  selectedButExcluded: VacancyEvaluation[];
  selectedNeedsReview: VacancyEvaluation[];
}

export function checkSelection(
  evaluations: VacancyEvaluation[],
  selectedVacancyIds: string[]
): SelectionCheck {
  const selected = new Set(selectedVacancyIds);
  return {
    missingCompatible: evaluations.filter(
      e => e.included && e.warnings.length === 0 && !selected.has(e.vacancyId)
    ),
    selectedButExcluded: evaluations.filter(
      e => !e.included && selected.has(e.vacancyId)
    ),
    selectedNeedsReview: evaluations.filter(
      e => e.included && e.requiresManualReview && selected.has(e.vacancyId)
    )
  };
}
