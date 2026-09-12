import { Injectable, BadRequestException } from '@nestjs/common';
import {
  DEFAULT_WEIGHTS,
  checkSelection,
  claveCentroTrayecto,
  evaluateVacancy,
  geolocalizarVacantes,
  rankAndGroup,
  type TravelEstimate,
  type UserProfile,
  type Vacancy,
  type VacancyEvaluation
} from '@plazainterinos/core';
import { PrismaService } from '../prisma/prisma.service';
import { exigirConvocatoriaPropia } from '../auth/propiedad';
import { FuelService } from '../fuel/fuel.service';
import { RutasService, clavePunto, puntoValido, type Punto } from '../geo/rutas.service';

@Injectable()
export class EvaluacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fuel: FuelService,
    private readonly rutas: RutasService
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
    const vacancies: Vacancy[] = rows.map((r: any) => ({
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
    // También recupera centros de convocatorias importadas antes del catálogo.
    geolocalizarVacantes(vacancies);
    return vacancies;
  }

  /**
   * Misma fuente de rutas para la previsualización de filtros y la evaluación.
   *
   * Se devuelve indexado por código de centro, no por id de vacante. La pantalla
   * de Filtrar trabaja con las vacantes que el navegador ha sacado del PDF, cuyos
   * ids son `ara-<numero>`, mientras que aquí los ids son los cuid de la base de
   * datos: por id no casaba ni una y todas las plazas salían "sin calcular". El
   * código de centro es lo único que comparten ambos lados, y además es lo que
   * de verdad determina la ruta: dos vacantes del mismo instituto tienen el
   * mismo trayecto.
   */
  async trayectos(userId: string, convocatoriaId: string, origen: Punto) {
    if (!origen || !puntoValido(origen)) throw new BadRequestException('La ubicación no es válida.');
    await exigirConvocatoriaPropia(this.prisma, userId, convocatoriaId);
    const vacancies = await this.cargarVacantes(convocatoriaId);
    const porVacante = await this.calcularTrayectos(
      { latitude: origen.lat, longitude: origen.lng }, vacancies
    );
    const porCentro: Record<string, TravelEstimate | null> = {};
    for (const v of vacancies) {
      const clave = claveCentroTrayecto(v.centerCode);
      if (!clave) continue;
      // Una ruta calculada manda sobre el hueco que deje otra vacante del mismo
      // centro sin coordenadas.
      if (porCentro[clave] == null) porCentro[clave] = porVacante[v.id] ?? null;
    }
    return porCentro;
  }

  /** Las dos pantallas resuelven los mismos centros y consumen la misma caché. */
  private async calcularTrayectos(
    home: UserProfile['homeLocation'],
    vacancies: Vacancy[]
  ): Promise<Record<string, TravelEstimate | null>> {
    const { latitude, longitude } = home;
    if (latitude == null || longitude == null) {
      return Object.fromEntries(vacancies.map(v => [v.id, null]));
    }
    const destinos = vacancies
      .filter(v => v.latitude != null && v.longitude != null)
      .map(v => ({ lat: v.latitude as number, lng: v.longitude as number }));
    const rutas = await this.rutas.calcular({ lat: latitude, lng: longitude }, destinos);
    return Object.fromEntries(vacancies.map(v => {
      const ruta = v.latitude != null && v.longitude != null
        ? rutas.get(clavePunto({ lat: v.latitude, lng: v.longitude })) : undefined;
      return [v.id, ruta ? { distanceKm: ruta.km, travelMinutes: ruta.minutos } : null];
    }));
  }

  async evaluar(userId: string, convocatoriaId: string) {
    await exigirConvocatoriaPropia(this.prisma, userId, convocatoriaId);
    const profile = await this.cargarPerfil(userId);
    const vacancies = await this.cargarVacantes(convocatoriaId);
    if (!vacancies.length) throw new BadRequestException('La convocatoria no tiene vacantes.');

    // Precio del combustible: el del perfil, o la media oficial actual.
    let fuelPricePerLiter: number | undefined;
    if (profile.car && profile.car.fuelPricePerLiter == null) {
      const precios = await this.fuel.prices();
      fuelPricePerLiter = profile.car.fuelType === 'diesel' ? precios.diesel : precios.gasolina;
    }

    const trayectos = await this.calcularTrayectos(profile.homeLocation, vacancies);
    const travelEstimator = { estimate: (_profile: UserProfile, v: Vacancy) => trayectos[v.id] ?? undefined };
    const evaluations = vacancies.map(v =>
      evaluateVacancy(v, profile, { fuelPricePerLiter, travelEstimator })
    );
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

  async comprobar(userId: string, convocatoriaId: string, selectedIds: string[]) {
    await exigirConvocatoriaPropia(this.prisma, userId, convocatoriaId);
    const rows = await this.prisma.evaluation.findMany({ where: { convocatoriaId } });
    const evaluations: VacancyEvaluation[] = rows.map((r: any) => ({
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
    // La comprobación se devuelve con la ficha de cada vacante, igual que
    // `evaluar`. Sin esto el cliente recibe filas sin `vacancy` y la pantalla
    // de Comprobación no puede pintar ni el nombre del centro.
    const vacantes = await this.prisma.vacancy.findMany({ where: { convocatoriaId } });
    const porId = new Map(vacantes.map((v: any) => [v.id, v]));
    const conFicha = (e: VacancyEvaluation) => ({ ...e, vacancy: porId.get(e.vacancyId) });

    const check = checkSelection(evaluations, selectedIds);
    return {
      missingCompatible: check.missingCompatible.map(conFicha),
      selectedButExcluded: check.selectedButExcluded.map(conFicha),
      selectedNeedsReview: check.selectedNeedsReview.map(conFicha)
    };
  }
}
