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

type ReminderAction = 'email' | 'popup' | 'notification';

export interface ZohoEventBody {
  title: string;
  start: string;
  end: string;
  description?: string;
  status?: string;

  isRecurring?: boolean;
  repeatUntil?: string;
  daysOfWeek?: string[];

  reminderEnabled?: boolean;
  reminderAction?: ReminderAction;
  reminderMinutes?: number;

  notifyPersonal?: boolean;
  attendeeEmail?: string;
}

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
    @Body() body: ZohoEventBody,
  ) {
    return this.zohoService.createEvent(calendar, body);
  }

  @Put('events/:id')
  updateEvent(
    @Query('calendar') calendar: string | undefined,
    @Param('id') id: string,
    @Body() body: ZohoEventBody,
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
