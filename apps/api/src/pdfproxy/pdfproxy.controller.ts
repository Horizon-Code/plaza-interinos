import { BadRequestException, Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AuthGuard } from '../auth/auth.guard';
import { IsString, IsUrl } from 'class-validator';

const LIMITE_BYTES = 50 * 1024 * 1024;

export class FetchPdfDto {
  @IsString()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true }, { message: 'La URL del PDF no es válida.' })
  url!: string;
}

/**
 * Descarga un PDF por URL en el servidor y lo reenvía al navegador. Evita el
 * CORS de los portales oficiales; el parseo sigue haciéndose en el cliente.
 */
@Controller('pdf')
@UseGuards(AuthGuard)
export class PdfProxyController {
  @Post('fetch')
  async fetch(@Body() dto: FetchPdfDto, @Res() reply: FastifyReply) {
    let respuesta: Response;
    try {
      respuesta = await fetch(dto.url, {
        signal: AbortSignal.timeout(60_000),
        headers: { 'User-Agent': 'PlazaInterinos/0.1' }
      });
    } catch {
      throw new BadRequestException('No se ha podido descargar el PDF de esa URL.');
    }
    if (!respuesta.ok) {
      throw new BadRequestException(`La URL respondió con error ${respuesta.status}.`);
    }
    const contentLength = Number(respuesta.headers.get('content-length') ?? 0);
    if (contentLength > LIMITE_BYTES) {
      throw new BadRequestException('El PDF supera el límite de 50 MB.');
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (buffer.byteLength > LIMITE_BYTES) {
      throw new BadRequestException('El PDF supera el límite de 50 MB.');
    }
    // Validar que es un PDF de verdad (cabecera %PDF).
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('La URL no devuelve un PDF.');
    }
    reply.type('application/pdf').send(buffer);
  }
}
