import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  buildDetectedConditions,
  extractFromAdditionalInfo,
  geolocalizarVacantes
} from '@plazainterinos/core';
import type { VacancyRequirement } from '@plazainterinos/core';
import { PrismaService } from '../prisma/prisma.service';
import { exigirConvocatoriaPropia } from '../auth/propiedad';
import { ImportDto } from './dto/import.dto';

@Injectable()
export class ConvocatoriaService {
  private readonly logger = new Logger(ConvocatoriaService.name);

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

    // El PDF no trae coordenadas, solo el código de centro: aquí es donde las
    // vacantes ganan latitud/longitud y, con ellas, distancia y coste €/día.
    const geo = geolocalizarVacantes(rows);
    if (geo.centrosSinCruce.length) {
      this.logger.warn(
        `Convocatoria ${convocatoria.id}: ${geo.total - geo.conCoordenadas} vacantes sin coordenadas ` +
          `en ${geo.centrosSinCruce.length} centros no catalogados (${geo.centrosSinCruce.join(', ')}).`
      );
    }

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
      ).length,
      sinCoordenadas: geo.total - geo.conCoordenadas
    };
    const detectedConditions = buildDetectedConditions(
      rows.map((r: any) => ({ requirements: r.requirements as VacancyRequirement[] }))
    );
    return { convocatoriaId: convocatoria.id, summary, detectedConditions };
  }

  /** Condiciones detectadas de una convocatoria ya importada (para recargas de la web). */
  async conditions(userId: string, convocatoriaId: string) {
    await exigirConvocatoriaPropia(this.prisma, userId, convocatoriaId);
    const rows = await this.prisma.vacancy.findMany({
      where: { convocatoriaId },
      select: { requirements: true }
    });
    if (!rows.length) throw new BadRequestException('La convocatoria no existe o no tiene vacantes.');
    return buildDetectedConditions(
      rows.map((r: any) => ({ requirements: r.requirements as unknown as VacancyRequirement[] }))
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

  async listVacancies(userId: string, convocatoriaId: string) {
    await exigirConvocatoriaPropia(this.prisma, userId, convocatoriaId);
    return this.prisma.vacancy.findMany({ where: { convocatoriaId } });
  }
}
