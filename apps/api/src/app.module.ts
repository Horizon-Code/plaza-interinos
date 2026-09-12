import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PerfilModule } from './perfil/perfil.module';
import { ConvocatoriaModule } from './convocatoria/convocatoria.module';
import { EvaluacionModule } from './evaluacion/evaluacion.module';
import { GeoModule } from './geo/geo.module';
import { FuelModule } from './fuel/fuel.module';
import { PdfProxyModule } from './pdfproxy/pdfproxy.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // MailModule queda fuera desde que se entra con Google: la aplicacion ya no
    // envia ningun correo. El codigo sigue en `src/mail/` porque el dia que
    // haya avisos o recordatorios hara falta otra vez.
    AuthModule,
    PerfilModule,
    ConvocatoriaModule,
    EvaluacionModule,
    // PagosModule queda fuera a proposito mientras la aplicacion es gratuita.
    //
    // No es solo que no se cobre: el codigo de pagos tiene dos agujeros y la web
    // no lo usa para nada. `/pagos/webhook` no verifica la firma de Stripe pese
    // a lo que dice su comentario, asi que cualquiera puede enviarle un JSON y
    // dar un pago por cobrado; y `/pagos/simular-pago` marca pagado cualquier
    // `paymentId` sin comprobar de quien es. Registrar el modulo publicaba las
    // dos rutas. El codigo sigue en `src/pagos/` para retomarlo: antes de volver
    // a registrarlo hay que verificar la firma con `stripe.webhooks.constructEvent`
    // y comprobar la propiedad del pago, como hace `auth/propiedad.ts`.
    GeoModule,
    FuelModule,
    PdfProxyModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
