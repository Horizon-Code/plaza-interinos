import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PerfilModule } from './perfil/perfil.module';
import { ConvocatoriaModule } from './convocatoria/convocatoria.module';
import { EvaluacionModule } from './evaluacion/evaluacion.module';
import { PagosModule } from './pagos/pagos.module';
import { GeoModule } from './geo/geo.module';
import { FuelModule } from './fuel/fuel.module';
import { PdfProxyModule } from './pdfproxy/pdfproxy.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PerfilModule,
    ConvocatoriaModule,
    EvaluacionModule,
    PagosModule,
    GeoModule,
    FuelModule,
    PdfProxyModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
