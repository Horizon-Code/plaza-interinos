import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GeoService } from './geo.service';

@Controller('geo')
@UseGuards(AuthGuard)
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('geocode')
  geocode(@Query('q') q?: string) {
    if (!q?.trim()) throw new BadRequestException('Falta la dirección a localizar (?q=).');
    return this.geo.geocode(q);
  }
}
