import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Comprueba que una convocatoria sea de quien la pide.
 *
 * Tener sesión no basta: el `AuthGuard` solo dice quién eres, no a qué puedes
 * llegar. Sin esta comprobación cualquier usuario con sesión podía pedir las
 * vacantes de la convocatoria de otro con solo su id, y `evaluar` llegaba a
 * borrarle las evaluaciones antes de escribir las suyas. Que los ids sean cuid
 * y no se adivinen a lo bruto no es control de acceso: un id se filtra en una
 * URL compartida, en un log o en una captura de pantalla.
 *
 * Se lanza el mismo 404 tanto si la convocatoria no existe como si es de otra
 * persona: distinguirlos confirmaría a un desconocido que ese id existe.
 *
 * Todo endpoint que reciba un `convocatoriaId` del cliente pasa por aquí.
 */
export async function exigirConvocatoriaPropia(
  prisma: PrismaService,
  userId: string,
  convocatoriaId: string
): Promise<void> {
  const suya = await prisma.convocatoria.findFirst({
    where: { id: convocatoriaId, userId },
    select: { id: true }
  });
  if (!suya) throw new NotFoundException('No se encuentra la convocatoria.');
}
