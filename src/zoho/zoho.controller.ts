import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
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

  @Put('events/:id')
  @UseGuards(JwtAuthGuard)
  updateEvent(
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      start: string;
      end: string;
      description?: string;
      status: string;
    },
  ) {
    return this.zohoService.updateEvent(id, body);
  }

  @Delete('events/:id')
  @UseGuards(JwtAuthGuard)
  deleteEvent(@Param('id') id: string) {
    return this.zohoService.deleteEvent(id);
  }
}
