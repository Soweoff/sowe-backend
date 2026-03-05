import { Module } from '@nestjs/common';
import { MondayController } from './monday.controller';
import { MondayService } from './monday.service';

@Module({
  controllers: [MondayController],
  providers: [MondayService],
})
export class MondayModule {}
