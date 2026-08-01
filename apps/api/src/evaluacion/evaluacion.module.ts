import { Module } from '@nestjs/common';
import { EvaluacionController } from './evaluacion.controller';
import { EvaluacionService } from './evaluacion.service';
import { FuelModule } from '../fuel/fuel.module';

@Module({
  imports: [FuelModule],
  controllers: [EvaluacionController],
  providers: [EvaluacionService]
})
export class EvaluacionModule {}
