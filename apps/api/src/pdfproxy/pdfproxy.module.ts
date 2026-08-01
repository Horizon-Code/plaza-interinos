import { Module } from '@nestjs/common';
import { PdfProxyController } from './pdfproxy.controller';

@Module({
  controllers: [PdfProxyController]
})
export class PdfProxyModule {}
