import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@plazainterinos.es';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: 'no-usar-en-produccion', name: 'Demo' }
  });

  const convocatoria = await prisma.convocatoria.create({
    data: { userId: user.id, sourceName: 'Ejemplo Aragón', parserVersion: 'aragon_v1' }
  });

  const raw = JSON.parse(readFileSync(join(__dirname, 'seed-vacantes.json'), 'utf-8')) as any[];
  await prisma.vacancy.createMany({
    data: raw.map(v => ({
      convocatoriaId: convocatoria.id,
      externalId: v.id,
      province: v.province,
      municipality: v.municipality,
      bodyCode: v.bodyCode,
      specialtyCode: v.specialtyCode,
      specialtyName: v.specialtyName,
      centerCode: v.centerCode,
      centerName: v.centerName,
      workload: v.workload,
      voluntary: false,
      additionalInfoRaw: v.additionalInfoRaw ?? null,
      requirements: [],
      tags: [],
      latitude: v.latitude,
      longitude: v.longitude,
      sourcePage: v.sourcePage
    }))
  });

  console.log(`Seed: usuario ${user.email}, convocatoria ${convocatoria.id}, ${raw.length} vacantes.`);
}

main().finally(() => prisma.$disconnect());
