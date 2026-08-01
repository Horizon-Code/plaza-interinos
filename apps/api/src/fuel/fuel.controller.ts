import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { FuelService } from './fuel.service';

@Controller('fuel')
@UseGuards(AuthGuard)
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @Get('prices')
  prices() {
    return this.fuel.prices();
  }
}
