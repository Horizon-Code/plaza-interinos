import { Injectable, BadRequestException } from '@nestjs/common';
import {
  DEFAULT_WEIGHTS,
  checkSelection,
  evaluateVacancy,
  rankAndGroup,
  type UserProfile,
  type Vacancy,
  type VacancyEvaluation
} from '@plazainterinos/core';
import { PrismaService } from '../prisma/prisma.service';
import { FuelService } from '../fuel/fuel.service';

@Injectable()
export class EvaluacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fuel: FuelService
  ) {}

  private async cargarPerfil(userId: string): Promise<UserProfile> {
    const p = await this.prisma.profile.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    if (!p) throw new BadRequestException('Guarda primero un perfil.');
    return {
      id: p.id,
      name: p.name,
      homeLocation: {
        address: p.homeAddress ?? undefined,
        municipality: p.homeMunicipality ?? undefined,
        latitude: p.homeLat ?? undefined,
        longitude: p.homeLng ?? undefined
      },
      specialties: p.specialties as any,
      maxDistanceKm: p.maxDistanceKm ?? undefined,
      maxTravelMinutes: p.maxTravelMinutes ?? undefined,
      acceptsPartialWorkload: p.acceptsPartialWorkload,
      minimumWorkload: p.minimumWorkload ?? undefined,
      acceptsVoluntary: p.acceptsVoluntary,
      acceptsAfternoon: p.acceptsAfternoon,
      acceptsItinerant: p.acceptsItinerant,
      acceptsBilingual: p.acceptsBilingual,
      acceptsLongTerm: p.acceptsLongTerm,
      acceptedLanguages: p.acceptedLanguages as string[],
      excludedPrograms: p.excludedPrograms as string[],
      excludedTags: p.excludedTags as string[],
      preferredMunicipalities: p.preferredMunicipalities as string[],
      excludedMunicipalities: p.excludedMunicipalities as string[],
      preferredCenters: p.preferredCenters as string[],
      excludedCenters: p.excludedCenters as string[],
      rankingWeights: (p.rankingWeights as any) ?? DEFAULT_WEIGHTS,
      travelMode: (p.travelMode as 'minutes' | 'km') ?? 'minutes',
      workloadTravelTiers: (p.workloadTravelTiers as any) ?? [],
      travelWorkloadBands: (p.travelWorkloadBands as any) ?? [],
      conditionAccepts: (p.conditionAccepts as any) ?? {},
      conditionTravelLimits: (p.conditionTravelLimits as any) ?? {},
      car: p.carFuelType && p.carConsumption
        ? {
            fuelType: p.carFuelType as 'diesel' | 'gasolina',
            consumptionLper100: p.carConsumption,
            fuelPricePerLiter: p.fuelPriceOverride ?? undefined
          }
        : undefined
    };
  }

  private async cargarVacantes(convocatoriaId: string): Promise<Vacancy[]> {
    const rows = await this.prisma.vacancy.findMany({ where: { convocatoriaId } });
    return rows.map(r => ({
      id: r.id,
      source: 'db',
      community: 'aragon',
      province: r.province ?? undefined,
      municipality: r.municipality ?? undefined,
      bodyCode: r.bodyCode ?? undefined,
      specialtyCode: r.specialtyCode ?? undefined,
      specialtyName: r.specialtyName ?? undefined,
      centerCode: r.centerCode ?? undefined,
      centerName: r.centerName ?? undefined,
      centerAddress: r.centerAddress ?? undefined,
      workload: r.workload ?? undefined,
      scheduleType: (r.scheduleType as any) ?? 'unknown',
      voluntary: r.voluntary,
      voluntaryReasonCodes: [],
      durationType: (r.durationType as any) ?? 'unknown',
      additionalInfoRaw: r.additionalInfoRaw ?? undefined,
      requirements: r.requirements as any,
      tags: r.tags as string[],
      latitude: r.latitude ?? undefined,
      longitude: r.longitude ?? undefined,
      sourcePage: r.sourcePage ?? undefined,
      sourceRow: r.sourceRow ?? undefined,
      parsedAt: new Date().toISOString()
    }));
  }

  async evaluar(userId: string, convocatoriaId: string) {
    const profile = await this.cargarPerfil(userId);
    const vacancies = await this.cargarVacantes(convocatoriaId);
    if (!vacancies.length) throw new BadRequestException('La convocatoria no tiene vacantes.');

    // Precio del combustible: el del perfil, o la media oficial actual.
    let fuelPricePerLiter: number | undefined;
    if (profile.car && profile.car.fuelPricePerLiter == null) {
      const precios = await this.fuel.prices();
      fuelPricePerLiter = profile.car.fuelType === 'diesel' ? precios.diesel : precios.gasolina;
    }

    const evaluations = vacancies.map(v => evaluateVacancy(v, profile, { fuelPricePerLiter }));
    const groups = rankAndGroup(evaluations, profile.rankingWeights);

    await this.prisma.evaluation.deleteMany({ where: { convocatoriaId } });
    await this.prisma.evaluation.createMany({
      data: evaluations.map(e => ({
        convocatoriaId,
        vacancyId: e.vacancyId,
        included: e.included,
        score: e.score,
        distanceKm: e.distanceKm,
        travelMinutes: e.travelMinutes,
        dailyCostEur: e.dailyCostEur,
        requiresManualReview: e.requiresManualReview,
        hardExclusionReasons: e.hardExclusionReasons as any,
        warnings: e.warnings as any,
        positiveReasons: e.positiveReasons as any
      }))
    });

    const withVacancy = (e: VacancyEvaluation) => ({ ...e, vacancy: vacancies.find(v => v.id === e.vacancyId) });
    return {
      recommended: groups.recommended.map(withVacancy),
      withWarnings: groups.withWarnings.map(withVacancy),
      excluded: groups.excluded.map(withVacancy)
    };
  }

  async comprobar(convocatoriaId: string, selectedIds: string[]) {
    const rows = await this.prisma.evaluation.findMany({ where: { convocatoriaId } });
    const evaluations: VacancyEvaluation[] = rows.map(r => ({
      vacancyId: r.vacancyId,
      included: r.included,
      score: r.score,
      distanceKm: r.distanceKm ?? undefined,
      travelMinutes: r.travelMinutes ?? undefined,
      requiresManualReview: r.requiresManualReview,
      hardExclusionReasons: r.hardExclusionReasons as any,
      warnings: r.warnings as any,
      positiveReasons: r.positiveReasons as any
    }));
    return checkSelection(evaluations, selectedIds);
  }
}
