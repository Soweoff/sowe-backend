import { Module } from '@nestjs/common';
import { MondayController } from './monday.controller';
import { MondayService } from './monday.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [MondayController],
  providers: [MondayService],
})
export class MondayModule {}
