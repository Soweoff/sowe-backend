import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ZohoService } from './zoho.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('zoho')
export class ZohoController {
  constructor(private readonly zohoService: ZohoService) {}

  @UseGuards(JwtAuthGuard) // Protegendo a rota (ID8)
  @Get('events')
  async getEvents() {
    return await this.zohoService.getEvents();
  }

  @Post('events')
  @UseGuards(JwtAuthGuard) // Mantém a segurança, só logados podem criar
  createEvent(
    @Body()
    body: {
      title: string;
      start: string;
      end: string;
      description?: string;
      status: string;
    },
  ) {
    return this.zohoService.createEvent(body);
  }
}
