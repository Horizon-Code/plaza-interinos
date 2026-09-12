import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

/**
 * Verificación del identificador que devuelve «Entrar con Google».
 *
 * El navegador recibe de Google un ID token (un JWT firmado por Google) y nos
 * lo manda. Aquí se comprueba de verdad: la firma contra las claves públicas de
 * Google, que el token sea PARA esta aplicación y que venga de Google. Sin esa
 * comprobación cualquiera podría fabricarse un JSON con el correo de otra
 * persona y entrar como ella; el ID token solo vale si se valida.
 *
 * `OAuth2Client` se encarga de descargar y cachear las claves de Google, así
 * que la verificación no sale a la red en cada entrada.
 */
@Injectable()
export class GoogleService {
  private readonly log = new Logger(GoogleService.name);
  private cliente?: OAuth2Client;

  /** Sin client ID no hay entrada posible: se prefiere fallar a dejar pasar. */
  get clientId(): string {
    const id = process.env['GOOGLE_CLIENT_ID']?.trim();
    if (!id) {
      this.log.error('GOOGLE_CLIENT_ID sin configurar: nadie puede entrar.');
      throw new UnauthorizedException('La entrada con Google no está configurada.');
    }
    return id;
  }

  get configurado(): boolean {
    return !!process.env['GOOGLE_CLIENT_ID']?.trim();
  }

  /**
   * Devuelve el correo y el identificador de Google, o falla.
   *
   * Se exige `email_verified`: Google puede emitir un token con un correo que
   * su titular no ha confirmado, y ese correo es justo lo que usamos para
   * reconocer a quien ya tenía cuenta aquí.
   */
  async verificar(idToken: string): Promise<{ googleId: string; email: string; nombre?: string }> {
    const clientId = this.clientId;
    this.cliente ??= new OAuth2Client(clientId);

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.cliente.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch (error) {
      this.log.warn(`ID token de Google rechazado: ${error instanceof Error ? error.message : error}`);
      throw new UnauthorizedException('No hemos podido verificar tu cuenta de Google. Inténtalo de nuevo.');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google no ha devuelto un correo con el que entrar.');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Esa cuenta de Google no tiene el correo verificado.');
    }

    return {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      nombre: payload.name ?? undefined
    };
  }
}
