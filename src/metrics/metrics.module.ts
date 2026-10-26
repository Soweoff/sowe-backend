import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { PublicMetricsController } from './public-metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController, PublicMetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
