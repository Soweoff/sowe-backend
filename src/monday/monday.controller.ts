import { Controller, Get, UseGuards } from '@nestjs/common';
import { MondayService } from './monday.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('monday')
export class MondayController {
  constructor(private readonly mondayService: MondayService) {}

  @Get('tasks')
  @UseGuards(JwtAuthGuard)
  getTasks() {
    return this.mondayService.getTasks();
  }
}
