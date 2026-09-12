import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { ConvocatoriaService } from './convocatoria.service';
import { ImportDto } from './dto/import.dto';

@Controller('convocatoria')
@UseGuards(AuthGuard)
export class ConvocatoriaController {
  constructor(private readonly service: ConvocatoriaService) {}

  @Post('import')
  importar(@CurrentUser() user: { sub: string }, @Body() dto: ImportDto) {
    return this.service.importar(user.sub, dto);
  }

  @Get(':id/vacancies')
  vacancies(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.service.listVacancies(user.sub, id);
  }

  @Get(':id/conditions')
  conditions(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.service.conditions(user.sub, id);
  }
}
