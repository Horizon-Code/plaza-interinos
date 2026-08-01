import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { PerfilService } from './perfil.service';
import { PerfilDto } from './dto/perfil.dto';

@Controller('profile')
@UseGuards(AuthGuard)
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Post()
  save(@CurrentUser() user: { sub: string }, @Body() dto: PerfilDto) {
    return this.perfil.upsert(user.sub, dto);
  }

  @Get()
  get(@CurrentUser() user: { sub: string }) {
    return this.perfil.find(user.sub);
  }
}
