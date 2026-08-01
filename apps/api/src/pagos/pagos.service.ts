import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pago POR CAMPAÑA, no suscripción: el dolor es estacional (convocatorias).
 * Precio configurable con CAMPAIGN_PRICE_CENTS (por defecto 24,99 €).
 *
 * Flujo: el frontend pide una sesión de Checkout -> Stripe cobra -> el webhook
 * confirma el pago y marca el Payment como 'paid'. La app desbloquea el
 * análisis completo cuando hay un pago 'paid' para esa campaña.
 */
@Injectable()
export class PagosService {
  private stripe: Stripe | null = null;

  constructor(private readonly prisma: PrismaService) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) this.stripe = new Stripe(key);
  }

  private get priceCents(): number {
    return Number(process.env.CAMPAIGN_PRICE_CENTS ?? 2499);
  }

  async crearCheckout(userId: string, origin: string) {
    const payment = await this.prisma.payment.create({
      data: { userId, amountCents: this.priceCents, status: 'pending' }
    });

    if (!this.stripe) {
      // Modo desarrollo sin claves: devuelve una URL simulada.
      return { url: `${origin}/pago-simulado?ref=${payment.id}`, paymentId: payment.id, simulated: true };
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'TuPlaza — análisis de campaña' },
          unit_amount: this.priceCents
        },
        quantity: 1
      }],
      success_url: `${origin}/resultado?pago=ok`,
      cancel_url: `${origin}/resultado?pago=cancelado`,
      metadata: { paymentId: payment.id, userId }
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: session.id }
    });
    return { url: session.url, paymentId: payment.id, simulated: false };
  }

  async marcarPagado(paymentId: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'paid' }
    });
  }

  async tienePagoActivo(userId: string): Promise<boolean> {
    const pago = await this.prisma.payment.findFirst({
      where: { userId, status: 'paid' },
      orderBy: { createdAt: 'desc' }
    });
    return !!pago;
  }
}
