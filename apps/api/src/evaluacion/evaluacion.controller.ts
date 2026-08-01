import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { EvaluacionService } from './evaluacion.service';

@Controller('evaluacion')
@UseGuards(AuthGuard)
export class EvaluacionController {
  constructor(private readonly service: EvaluacionService) {}

  @Post(':convocatoriaId')
  evaluar(@CurrentUser() user: { sub: string }, @Param('convocatoriaId') id: string) {
    return this.service.evaluar(user.sub, id);
  }

  @Post(':convocatoriaId/check')
  comprobar(@Param('convocatoriaId') id: string, @Body() body: { selectedIds: string[] }) {
    return this.service.comprobar(id, body?.selectedIds ?? []);
  }
}
