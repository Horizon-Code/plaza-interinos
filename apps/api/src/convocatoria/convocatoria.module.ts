import { Module } from '@nestjs/common';
import { ConvocatoriaController } from './convocatoria.controller';
import { ConvocatoriaService } from './convocatoria.service';

@Module({
  controllers: [ConvocatoriaController],
  providers: [ConvocatoriaService],
  exports: [ConvocatoriaService]
})
export class ConvocatoriaModule {}
