import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsLatitude, IsLongitude } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { EvaluacionService } from './evaluacion.service';

class OrigenDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

@Controller('evaluacion')
@UseGuards(AuthGuard)
export class EvaluacionController {
  constructor(private readonly service: EvaluacionService) {}

  @Post(':convocatoriaId/trayectos')
  trayectos(@CurrentUser() user: { sub: string }, @Param('convocatoriaId') id: string, @Body() origen: OrigenDto) {
    return this.service.trayectos(user.sub, id, origen);
  }

  @Post(':convocatoriaId')
  evaluar(@CurrentUser() user: { sub: string }, @Param('convocatoriaId') id: string) {
    return this.service.evaluar(user.sub, id);
  }

  @Post(':convocatoriaId/check')
  comprobar(
    @CurrentUser() user: { sub: string },
    @Param('convocatoriaId') id: string,
    @Body() body: { selectedIds: string[] }
  ) {
    return this.service.comprobar(user.sub, id, body?.selectedIds ?? []);
  }
}
