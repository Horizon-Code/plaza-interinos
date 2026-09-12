import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { RutasService } from './rutas.service';

@Module({
  controllers: [GeoController],
  providers: [GeoService, RutasService],
  exports: [GeoService, RutasService]
})
export class GeoModule {}
