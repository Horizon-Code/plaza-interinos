import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MINUTO = 60_000;
/** Una visita con sesión guardada no se vuelve a apuntar hasta pasado esto. */
const HUECO_ENTRE_VISITAS = 30 * MINUTO;
/** La IP es dato personal: no se guarda más de lo necesario. */
const RETENCION = 90 * 24 * 60 * MINUTO;
const CADA_CUANTO_PURGAR = 24 * 60 * MINUTO;

export type TipoAcceso = 'google' | 'sesion';

type PeticionHttp = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Historial de quién entra y cuándo.
 *
 * Apuntar un acceso nunca puede tumbar la petición del usuario: si la base
 * falla aquí, se registra en el log y la petición sigue su curso.
 */
@Injectable()
export class AccesosService {
  private readonly log = new Logger(AccesosService.name);
  /** Última visita apuntada por usuario. En memoria: basta para no inundar la tabla. */
  private readonly ultimaVisita = new Map<string, number>();
  private ultimaPurga = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** Inicio de sesión explícito: siempre se apunta. */
  registrarEntrada(userId: string, req?: PeticionHttp): void {
    this.ultimaVisita.set(userId, Date.now());
    void this.guardar(userId, 'google', req);
  }

  /** Petición con sesión guardada: se apunta como mucho una vez cada 30 minutos. */
  registrarVisita(userId: string, req?: PeticionHttp): void {
    const ahora = Date.now();
    const anterior = this.ultimaVisita.get(userId);
    if (anterior !== undefined && ahora - anterior < HUECO_ENTRE_VISITAS) return;
    this.ultimaVisita.set(userId, ahora);
    void this.guardar(userId, 'sesion', req);
  }

  /** Quién puede ver el historial: correos de `ADMIN_EMAILS`, separados por comas. */
  esAdmin(email: string | undefined): boolean {
    if (!email) return false;
    const admins = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    return admins.includes(email.toLowerCase());
  }

  async listar(email: string | undefined, dias: number) {
    if (!this.esAdmin(email)) {
      throw new ForbiddenException('Solo para administración.');
    }
    const desde = new Date(Date.now() - Math.min(Math.max(dias, 1), 90) * 24 * 60 * MINUTO);
    const accesos = await this.prisma.acceso.findMany({
      where: { createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        createdAt: true,
        tipo: true,
        ip: true,
        userAgent: true,
        user: { select: { email: true, name: true } }
      }
    });
    const personas = new Set(accesos.map(a => a.user.email));
    return {
      desde: desde.toISOString(),
      personasDistintas: personas.size,
      total: accesos.length,
      accesos: accesos.map(a => ({
        fecha: a.createdAt,
        email: a.user.email,
        nombre: a.user.name,
        tipo: a.tipo,
        ip: a.ip,
        navegador: a.userAgent
      }))
    };
  }

  private async guardar(userId: string, tipo: TipoAcceso, req?: PeticionHttp) {
    try {
      await this.prisma.acceso.create({
        data: {
          userId,
          tipo,
          ip: ipCliente(req),
          userAgent: cabecera(req, 'user-agent')?.slice(0, 300) ?? null
        }
      });
      await this.purgarSiToca();
    } catch (e) {
      this.log.warn(`No se pudo apuntar el acceso: ${(e as Error).message}`);
    }
  }

  private async purgarSiToca() {
    const ahora = Date.now();
    if (ahora - this.ultimaPurga < CADA_CUANTO_PURGAR) return;
    this.ultimaPurga = ahora;
    await this.prisma.acceso.deleteMany({
      where: { createdAt: { lt: new Date(ahora - RETENCION) } }
    });
  }
}

function cabecera(req: PeticionHttp | undefined, nombre: string): string | undefined {
  const valor = req?.headers?.[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Detrás del proxy de Fly, `req.ip` es el del proxy: la IP real llega en cabecera. */
function ipCliente(req: PeticionHttp | undefined): string | null {
  return (
    cabecera(req, 'fly-client-ip') ??
    cabecera(req, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    req?.ip ??
    null
  );
}
