import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
