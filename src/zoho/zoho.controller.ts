import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ZohoService } from './zoho.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('zoho')
export class ZohoController {
  constructor(private readonly zohoService: ZohoService) {}

  @UseGuards(JwtAuthGuard)
  @Get('events')
  getEvents() {
    return this.zohoService.getEvents();
  }

  @Post('events')
  @UseGuards(JwtAuthGuard)
  createEvent(
    @Body()
    body: {
      title: string;
      start: string;
      end: string;
      description?: string;
      status: string;
      isRecurring?: boolean;
      repeatUntil?: string;
      daysOfWeek?: string[];
    },
  ) {
    return this.zohoService.createEvent(body);
  }
}
