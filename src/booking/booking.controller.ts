import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  RateLimit,
  RateLimitGuard,
} from '../common/security/rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Público: qualquer visitante vê os horários livres e envia um pedido.
@Controller('booking')
@UseGuards(RateLimitGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Get('slots')
  @RateLimit({ limit: 120, windowSec: 15 * 60 })
  @Header('Cache-Control', 'no-store')
  slots() {
    return this.booking.getSlots();
  }

  @Post()
  @RateLimit({ limit: 20, windowSec: 60 * 60 })
  request(@Body() body: CreateBookingDto) {
    return this.booking.request(body);
  }
}

// Somente ADMIN: aprovar ou recusar pedidos.
@ApiBearerAuth()
@Controller('booking/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BookingAdminController {
  constructor(private readonly booking: BookingService) {}

  @Get('pending')
  @Header('Cache-Control', 'no-store')
  pending() {
    return this.booking.listPending();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.booking.approve(id);
  }

  @Delete(':id')
  reject(@Param('id') id: string) {
    return this.booking.reject(id);
  }
}
