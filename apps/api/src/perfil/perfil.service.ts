import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilDto } from './dto/perfil.dto';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: PerfilDto) {
    const home = dto.homeLocation ?? {};
    const data = {
      userId,
      name: dto.name ?? 'Mi perfil',
      homeAddress: home.address,
      homeMunicipality: home.municipality,
      homeLat: home.latitude,
      homeLng: home.longitude,
      maxDistanceKm: dto.maxDistanceKm,
      maxTravelMinutes: dto.maxTravelMinutes,
      acceptsPartialWorkload: dto.acceptsPartialWorkload,
      minimumWorkload: dto.minimumWorkload,
      acceptsVoluntary: dto.acceptsVoluntary,
      acceptsAfternoon: dto.acceptsAfternoon,
      acceptsItinerant: dto.acceptsItinerant,
      acceptsBilingual: dto.acceptsBilingual,
      acceptsLongTerm: dto.acceptsLongTerm,
      specialties: dto.specialties as object,
      acceptedLanguages: dto.acceptedLanguages,
      excludedPrograms: dto.excludedPrograms,
      excludedTags: dto.excludedTags,
      preferredMunicipalities: dto.preferredMunicipalities,
      excludedMunicipalities: dto.excludedMunicipalities,
      preferredCenters: dto.preferredCenters,
      excludedCenters: dto.excludedCenters,
      travelMode: dto.travelMode ?? 'minutes',
      carFuelType: dto.car?.fuelType ?? null,
      carConsumption: dto.car?.consumptionLper100 ?? null,
      fuelPriceOverride: dto.car?.fuelPricePerLiter ?? null,
      workloadTravelTiers: (dto.workloadTravelTiers ?? []) as object,
      travelWorkloadBands: (dto.travelWorkloadBands ?? []) as object,
      conditionAccepts: (dto.conditionAccepts ?? {}) as object,
      conditionTravelLimits: (dto.conditionTravelLimits ?? {}) as object
    };
    const existing = await this.prisma.profile.findFirst({ where: { userId } });
    if (existing) {
      return this.prisma.profile.update({ where: { id: existing.id }, data });
    }
    return this.prisma.profile.create({ data });
  }

  async find(userId: string) {
    return this.prisma.profile.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }
}
