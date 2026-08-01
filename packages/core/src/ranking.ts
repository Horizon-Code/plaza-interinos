import type { RankingWeights, VacancyEvaluation } from './models.js';

/**
 * Ranking (sección 14). La fórmula del documento se normaliza para que
 * ningún criterio domine accidentalmente: cada componente aporta 0..1
 * antes de aplicar su peso.
 */
export function scoreEvaluation(
  evaluation: VacancyEvaluation,
  weights: RankingWeights
): number {
  let score = 0;
  let weightSum = 0;

  if (evaluation.distanceKm != null) {
    score += clamp01(1 - evaluation.distanceKm / 100) * weights.distance;
    weightSum += weights.distance;
  }
  if (evaluation.travelMinutes != null) {
    score += clamp01(1 - evaluation.travelMinutes / 120) * weights.travelTime;
    weightSum += weights.travelTime;
  }

  const positives = clamp01(evaluation.positiveReasons.length / 4);
  score += positives * weights.specialConditions;
  weightSum += weights.specialConditions;

  const warningPenalty = clamp01(evaluation.warnings.length / 4);
  score -= warningPenalty * (weights.specialConditions / 2);

  if (weightSum === 0) return 0;
  return Math.round((score / weightSum) * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface RankedGroups {
  recommended: VacancyEvaluation[];
  withWarnings: VacancyEvaluation[];
  excluded: VacancyEvaluation[];
}

/** Los tres bloques de la pantalla 4: recomendadas, posibles con advertencias, excluidas. */
export function rankAndGroup(
  evaluations: VacancyEvaluation[],
  weights: RankingWeights
): RankedGroups {
  for (const evaluation of evaluations) {
    evaluation.score = evaluation.included ? scoreEvaluation(evaluation, weights) : 0;
  }
  const byScore = (a: VacancyEvaluation, b: VacancyEvaluation) => b.score - a.score;

  return {
    recommended: evaluations
      .filter(e => e.included && e.warnings.length === 0 && !e.requiresManualReview)
      .sort(byScore),
    withWarnings: evaluations
      .filter(e => e.included && (e.warnings.length > 0 || e.requiresManualReview))
      .sort(byScore),
    excluded: evaluations.filter(e => !e.included)
  };
}
