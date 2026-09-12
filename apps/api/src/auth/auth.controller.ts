import { Body, Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './user.decorator';
import { LimitePeticiones } from './limite-peticiones';
import { EntrarConGoogleDto } from './dto/auth.dto';

const QUINCE_MINUTOS = 15 * 60_000;
/** Por IP, holgado: en un centro educativo varias personas comparten salida. */
const porIp = new LimitePeticiones(20, QUINCE_MINUTOS);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleService
  ) {}

  /**
   * Se entra con Google y ya está: el navegador manda el ID token que le ha
   * dado Google y aquí se cambia por una sesión nuestra.
   *
   * El límite por IP se mantiene aunque el token lo firme Google: verificarlo
   * cuesta trabajo, y esta ruta es pública. Sin límite, cualquiera puede tener
   * a la API ocupada validando basura.
   */
  @Post('google')
  @HttpCode(200)
  entrarConGoogle(@Body() dto: EntrarConGoogleDto, @Req() req: { ip?: string }) {
    if (!porIp.permite(req.ip ?? 'sin-ip')) {
      throw new HttpException(
        'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return this.auth.entrarConGoogle(dto.idToken);
  }

  /**
   * El identificador público de la aplicación en Google, para que el navegador
   * pueda pintar el botón.
   *
   * Se sirve desde aquí y no se compila dentro de la web para que cambiarlo no
   * obligue a reconstruir el frontend, y para que local y producción usen la
   * misma build con distinta configuración. No es un secreto: el client ID de
   * Google viaja en cada petición de autenticación y está pensado para ser
   * público (el que nunca sale de aquí es el client secret).
   */
  @Get('google/config')
  configuracionGoogle() {
    return {
      clientId: this.google.configurado ? this.google.clientId : null
    };
  }

  @Get('yo')
  @UseGuards(AuthGuard)
  yo(@CurrentUser() usuario: { sub: string }) {
    return this.auth.yo(usuario.sub);
  }

  /** Derecho de acceso: tu copia de todo lo que guardamos de ti. */
  @Get('mis-datos')
  @UseGuards(AuthGuard)
  misDatos(@CurrentUser() user: { sub: string }) {
    return this.auth.exportarDatos(user.sub);
  }

  /**
   * Derecho de supresión. Es `DELETE` y no un `POST` de baja porque eso es lo
   * que hace: borra la cuenta y todo lo que cuelga de ella, sin vuelta atrás.
   * Quien confirma es la web, que pide escribir el correo antes de llamar aquí.
   */
  @Delete('cuenta')
  @UseGuards(AuthGuard)
  borrarCuenta(@CurrentUser() user: { sub: string }) {
    return this.auth.borrarCuenta(user.sub);
  }
}
