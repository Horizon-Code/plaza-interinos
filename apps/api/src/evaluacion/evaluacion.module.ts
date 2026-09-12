import { Module } from '@nestjs/common';
import { EvaluacionController } from './evaluacion.controller';
import { EvaluacionService } from './evaluacion.service';
import { FuelModule } from '../fuel/fuel.module';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [FuelModule, GeoModule],
  controllers: [EvaluacionController],
  providers: [EvaluacionService]
})
export class EvaluacionModule {}
