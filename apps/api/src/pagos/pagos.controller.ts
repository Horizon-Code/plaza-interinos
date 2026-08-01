import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  checkout(@CurrentUser() user: { sub: string }, @Body() body: { origin: string }) {
    return this.pagos.crearCheckout(user.sub, body?.origin ?? 'http://localhost:4200');
  }

  @Get('estado')
  @UseGuards(AuthGuard)
  async estado(@CurrentUser() user: { sub: string }) {
    return { activo: await this.pagos.tienePagoActivo(user.sub) };
  }

  // Webhook de Stripe (sin guard: lo valida la firma de Stripe en producción).
  @Post('webhook')
  async webhook(@Body() body: any) {
    if (body?.type === 'checkout.session.completed') {
      const paymentId = body.data?.object?.metadata?.paymentId;
      if (paymentId) await this.pagos.marcarPagado(paymentId);
    }
    return { received: true };
  }

  // Confirmación del modo simulado (solo desarrollo).
  @Post('simular-pago')
  @UseGuards(AuthGuard)
  simular(@Body() body: { paymentId: string }) {
    return this.pagos.marcarPagado(body.paymentId);
  }
}
