import { Injectable, BadRequestException } from '@nestjs/common';
import { buildDetectedConditions, extractFromAdditionalInfo } from '@plazainterinos/core';
import type { VacancyRequirement } from '@plazainterinos/core';
import { PrismaService } from '../prisma/prisma.service';
import { ImportDto } from './dto/import.dto';

@Injectable()
export class ConvocatoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async importar(userId: string, dto: ImportDto) {
    if (!dto.vacancies?.length) {
      throw new BadRequestException('Se esperaba al menos una vacante.');
    }

    const convocatoria = await this.prisma.convocatoria.create({
      data: {
        userId,
        sourceName: dto.sourceName,
        parserVersion: dto.parserVersion ?? 'aragon_v1'
      }
    });

    const rows = dto.vacancies.map(raw => this.normalize(raw, convocatoria.id));
    await this.prisma.vacancy.createMany({ data: rows });

    const summary = {
      total: rows.length,
      voluntary: rows.filter(v => v.voluntary).length,
      languageRequirement: rows.filter(v =>
        (v.requirements as any[]).some(r => r.category === 'language' && r.required)
      ).length,
      afternoon: rows.filter(
        v => v.scheduleType === 'afternoon' || (v.tags as string[]).includes('afternoon')
      ).length,
      ambiguous: rows.filter(v =>
        (v.requirements as any[]).some(r => r.confidence < 0.7)
      ).length
    };
    const detectedConditions = buildDetectedConditions(
      rows.map(r => ({ requirements: r.requirements as VacancyRequirement[] }))
    );
    return { convocatoriaId: convocatoria.id, summary, detectedConditions };
  }

  /** Condiciones detectadas de una convocatoria ya importada (para recargas de la web). */
  async conditions(convocatoriaId: string) {
    const rows = await this.prisma.vacancy.findMany({
      where: { convocatoriaId },
      select: { requirements: true }
    });
    if (!rows.length) throw new BadRequestException('La convocatoria no existe o no tiene vacantes.');
    return buildDetectedConditions(
      rows.map(r => ({ requirements: r.requirements as unknown as VacancyRequirement[] }))
    );
  }

  private normalize(raw: Record<string, any>, convocatoriaId: string) {
    const extraction = extractFromAdditionalInfo(raw.additionalInfoRaw);
    const tags = Array.from(new Set([...(raw.tags ?? []), ...extraction.tags]));
    const requirements = [...(raw.requirements ?? []), ...extraction.requirements];
    const voluntary = raw.voluntary ?? tags.includes('voluntary');
    return {
      convocatoriaId,
      externalId: raw.id ?? raw.externalId,
      province: raw.province,
      municipality: raw.municipality,
      bodyCode: raw.bodyCode,
      specialtyCode: raw.specialtyCode,
      specialtyName: raw.specialtyName,
      centerCode: raw.centerCode,
      centerName: raw.centerName,
      centerAddress: raw.centerAddress,
      workload: raw.workload,
      scheduleType: raw.scheduleType ?? (tags.includes('afternoon') ? 'afternoon' : 'unknown'),
      voluntary,
      durationType: raw.durationType ?? (tags.includes('long_term') ? 'long_term' : 'unknown'),
      additionalInfoRaw: raw.additionalInfoRaw,
      requirements,
      tags,
      latitude: raw.latitude,
      longitude: raw.longitude,
      sourcePage: raw.sourcePage,
      sourceRow: raw.sourceRow
    };
  }

  listVacancies(convocatoriaId: string) {
    return this.prisma.vacancy.findMany({ where: { convocatoriaId } });
  }
}
