import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MondayService } from './monday.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// As tarefas do Monday são internas do estúdio: só administradores veem.
@ApiBearerAuth()
@Controller('monday')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MondayController {
  constructor(private readonly mondayService: MondayService) {}

  @Get('tasks')
  getTasks() {
    return this.mondayService.getTasks();
  }
}
