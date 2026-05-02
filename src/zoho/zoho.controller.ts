import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZohoService } from './zoho.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('zoho')
@UseGuards(JwtAuthGuard)
export class ZohoController {
  constructor(private readonly zohoService: ZohoService) {}

  @Get('events')
  getEvents(@Query('calendar') calendar?: string) {
    return this.zohoService.getEvents(calendar);
  }

  @Post('events')
  createEvent(
    @Query('calendar') calendar: string | undefined,
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
    return this.zohoService.createEvent(calendar, body);
  }

  @Put('events/:id')
  updateEvent(
    @Query('calendar') calendar: string | undefined,
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
    return this.zohoService.updateEvent(calendar, id, body);
  }

  @Delete('events/:id')
  deleteEvent(
    @Query('calendar') calendar: string | undefined,
    @Param('id') id: string,
  ) {
    return this.zohoService.deleteEvent(calendar, id);
  }
}
