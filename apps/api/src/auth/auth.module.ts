import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar',
      // Sesión larga a propósito: es una app de campaña. Con 7 días, en una
      // convocatoria de tres meses pedirías el enlace una docena de veces.
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '90d') as `${number}d` }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, GoogleService],
  exports: [AuthGuard, JwtModule]
})
export class AuthModule {}
