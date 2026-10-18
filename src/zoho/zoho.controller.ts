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
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZohoService } from './zoho.service';
import { ZohoEventDto } from './dto/zoho-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Qualquer usuário logado pode VER o planejamento (tela /dashboard).
// Criar, editar e excluir eventos é só para ADMIN.
@ApiBearerAuth()
@Controller('zoho')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ZohoController {
  constructor(private readonly zohoService: ZohoService) {}

  @Get('events')
  getEvents(@Query('calendar') calendar?: string) {
    return this.zohoService.getEvents(calendar);
  }

  @Post('events')
  @Roles('ADMIN')
  createEvent(
    @Query('calendar') calendar: string | undefined,
    @Body() body: ZohoEventDto,
  ) {
    return this.zohoService.createEvent(calendar, body);
  }

  @Put('events/:id')
  @Roles('ADMIN')
  updateEvent(
    @Query('calendar') calendar: string | undefined,
    @Param('id') id: string,
    @Body() body: ZohoEventDto,
  ) {
    return this.zohoService.updateEvent(calendar, id, body);
  }

  @Delete('events/:id')
  @Roles('ADMIN')
  deleteEvent(
    @Query('calendar') calendar: string | undefined,
    @Param('id') id: string,
  ) {
    return this.zohoService.deleteEvent(calendar, id);
  }
}
