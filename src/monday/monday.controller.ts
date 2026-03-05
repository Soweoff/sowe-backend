import { Controller, Get } from '@nestjs/common';
import { MondayService } from './monday.service';

@Controller('monday')
export class MondayController {
  constructor(private readonly mondayService: MondayService) {}

  @Get('tasks')
  getTasks() {
    return this.mondayService.getTasks();
  }
}
