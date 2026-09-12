import { Injectable, Logger } from '@nestjs/common';

/**
 * Envío de correo por la API REST de Resend (sin SDK: es una sola llamada y
 * añadir dependencia para eso no compensa).
 *
 * Sin `RESEND_API_KEY` no falla: escribe el enlace en el log. Así el login por
 * enlace mágico es usable en local desde el primer día, sin dar de alta nada.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly remitente = process.env.MAIL_FROM ?? 'PlazaInterinos <acceso@plazainterinos.es>';

  get configurado(): boolean {
    return Boolean(this.apiKey);
  }

  async enviarEnlaceAcceso(email: string, enlace: string): Promise<void> {
    if (!this.apiKey) {
      this.log.warn(
        `RESEND_API_KEY sin configurar. Enlace de acceso para ${email}:\n\n  ${enlace}\n`
      );
      return;
    }
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: this.remitente,
        to: [email],
        subject: 'Tu acceso a PlazaInterinos',
        html: plantilla(enlace),
        text: `Entra en PlazaInterinos con este enlace (caduca en 15 minutos):\n\n${enlace}\n\nSi no lo has pedido tú, ignora este correo.`
      })
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      this.log.error(`Resend respondió ${respuesta.status}: ${detalle}`);
      throw new Error('No se ha podido enviar el correo de acceso.');
    }
  }
}

function plantilla(enlace: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f6f5f0;font-family:'Segoe UI',system-ui,sans-serif;color:#1d2321">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:460px;background:#fff;border:1px solid #dcdad2;border-radius:10px;padding:28px">
        <tr><td style="font-size:20px;font-weight:700;color:#23443c;padding-bottom:4px">PlazaInterinos</td></tr>
        <tr><td style="font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#5a6560;padding-bottom:18px">Profesorado</td></tr>
        <tr><td style="font-size:16px;line-height:1.6;padding-bottom:22px">Pulsa el botón para entrar en tu cuenta. El enlace caduca en 15 minutos y solo sirve una vez.</td></tr>
        <tr><td style="padding-bottom:22px">
          <a href="${enlace}" style="display:inline-block;background:#23443c;color:#f6f5f0;text-decoration:none;
             padding:12px 22px;border-radius:8px;font-weight:600;font-size:16px">Entrar en PlazaInterinos</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#5a6560">
          Si el botón no funciona, copia esta dirección en el navegador:<br>
          <span style="word-break:break-all;color:#23443c">${enlace}</span>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#5a6560;padding-top:18px;border-top:1px solid #dcdad2;margin-top:18px">
          Si no has pedido este acceso, ignora este correo: sin pulsar el enlace no ocurre nada.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
