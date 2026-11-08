import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccesosService } from './accesos.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly accesos: AccesosService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Falta el token de sesión.');
    try {
      req.user = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Sesión no válida o caducada.');
    }
    // Quien vuelve con la sesión guardada no pasa por el login: se apunta aquí.
    this.accesos.registrarVisita(req.user.sub, req);
    return true;
  }
}
