import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RateService } from './rate.service';
import { WealthController } from './wealth.controller';
import { WealthService } from './wealth.service';

@Module({
  imports: [PrismaModule],
  controllers: [WealthController],
  providers: [WealthService, RateService],
})
export class WealthModule {}
