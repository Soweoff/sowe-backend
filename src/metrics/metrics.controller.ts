import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
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
  getYoutube() {
    return this.metricsService.getYoutube();
  }
}
