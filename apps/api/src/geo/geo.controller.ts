import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GeoService } from './geo.service';
import { puntoValido } from './rutas.service';

@Controller('geo')
@UseGuards(AuthGuard)
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('geocode')
  geocode(@Query('q') q?: string) {
    if (!q?.trim()) throw new BadRequestException('Falta la dirección a localizar (?q=).');
    return this.geo.geocode(q);
  }

  /**
   * Coordenadas → dirección. Lo usa el botón "Usar ubicación actual" del perfil:
   * `navigator.geolocation` solo da lat/lng, y el docente necesita ver de qué
   * sitio estamos hablando antes de fiarse de los trayectos.
   */
  @Get('reverse')
  reverse(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const latitud = Number(lat);
    const longitud = Number(lng);
    if (!lat?.trim() || !lng?.trim() || !puntoValido({ lat: latitud, lng: longitud })) {
      throw new BadRequestException('Faltan las coordenadas a resolver (?lat=&lng=).');
    }
    return this.geo.reverse(latitud, longitud);
  }
}
