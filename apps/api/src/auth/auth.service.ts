import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleService } from './google.service';

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly google: GoogleService
  ) {}

  /**
   * Entrada con Google: se verifica el ID token y se entra, sin correos de por
   * medio.
   *
   * Se busca primero por `googleId`, que es estable, y solo si no aparece se
   * busca por correo. Ese segundo intento es el que enlaza a quien ya tenía
   * cuenta de antes —cuando se entraba por enlace— con su cuenta de Google: se
   * le añade el `googleId` y conserva sus convocatorias y su perfil en vez de
   * estrenar una cuenta vacía.
   *
   * Enlazar por correo es seguro porque Google ya nos ha dicho que ese correo
   * está verificado: quien llega aquí ha demostrado ser su titular.
   */
  async entrarConGoogle(idToken: string) {
    const { googleId, email, nombre } = await this.google.verificar(idToken);

    const existente =
      (await this.prisma.user.findUnique({ where: { googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));

    const user = existente
      ? await this.prisma.user.update({
          where: { id: existente.id },
          // El nombre solo se rellena si no había: si alguien lo cambió aquí,
          // no se lo pisamos con el de Google en cada entrada.
          data: { googleId, lastLoginAt: new Date(), name: existente.name ?? nombre ?? null }
        })
      : await this.prisma.user.create({
          data: { email, googleId, name: nombre ?? null, lastLoginAt: new Date() }
        });

    return this.firmar(user.id, user.email);
  }

  /** Valida el token del enlace, lo quema y devuelve la sesión. */
  /** Datos de la sesión en curso, para pintar quién está dentro. */
  async yo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    if (!user) throw new UnauthorizedException('La cuenta ya no existe.');
    return user;
  }

  /**
   * El enlace del correo vive poco: es la llave de la cuenta viajando por ahí.
   *
   * Se lee al usarlo y no en una constante del módulo: `ConfigModule` vuelca el
   * `.env` en `process.env` DESPUÉS de importar los módulos, así que una
   * constante de nivel superior se quedaría siempre con el valor por defecto.
   */
  /** Atajo de desarrollo. Ver el comentario de `solicitarEnlace`. */
  /**
   * Todo lo que guardamos de una persona, para el derecho de acceso del RGPD.
   *
   * Se sirve tal cual está en la base: es su copia, no un resumen nuestro.
   */
  async exportarDatos(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: true,
        convocatorias: { include: { vacancies: true, evaluations: true } }
      }
    });
    if (!user) throw new NotFoundException('No se encuentra la cuenta.');
    const { password: _, ...sinPassword } = user;
    return { exportadoEn: new Date().toISOString(), cuenta: sinPassword };
  }

  /**
   * Borrado de cuenta: derecho de supresión del RGPD.
   *
   * Todo lo que cuelga del usuario cae por `onDelete: Cascade` (perfiles,
   * convocatorias, y con ellas vacantes y evaluaciones). Los enlaces de acceso
   * NO cuelgan: `LoginToken` se guarda por correo y no por usuario, así que hay
   * que borrarlos a mano o quedarían enlaces vivos de una cuenta que ya no
   * existe. Esa es la única parte que un `Cascade` no cubre.
   *
   * No hay marcha atrás y es lo que se pretende: un borrado que deja copia no
   * es un borrado.
   */
  async borrarCuenta(userId: string): Promise<{ borrada: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    if (!user) throw new NotFoundException('No se encuentra la cuenta.');
    await this.prisma.$transaction([
      this.prisma.loginToken.deleteMany({ where: { email: user.email } }),
      this.prisma.user.delete({ where: { id: userId } })
    ]);
    this.log.log('Cuenta borrada a petición de su titular.');
    return { borrada: true };
  }

  private firmar(userId: string, email: string) {
    const token = this.jwt.sign({ sub: userId, email });
    return { token, user: { id: userId, email } };
  }
}


