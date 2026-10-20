import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { parsePeriod } from './youtube.utils';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Métricas dos canais: painel interno, só para administradores.
@ApiBearerAuth()
@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('youtube')
  getYoutube(@Query('days') days?: string) {
    const period = parsePeriod(days);
    if (period === null) {
      throw new BadRequestException('days deve ser 30, 90 ou 365.');
    }
    return this.metricsService.getYoutube(period);
  }
}
