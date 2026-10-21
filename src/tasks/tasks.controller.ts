import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthedRequest {
  user: { userId: number };
}

const PERIODS = [7, 30, 90];

@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  active(@Req() req: AuthedRequest) {
    return this.tasks.listActive(req.user.userId);
  }

  @Get('report')
  @Header('Cache-Control', 'no-store')
  report(@Req() req: AuthedRequest, @Query('days') days?: string) {
    const n = Number(days);
    return this.tasks.report(req.user.userId, PERIODS.includes(n) ? n : 7);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateTaskDto) {
    return this.tasks.create(req.user.userId, body);
  }

  @Patch(':id/complete')
  complete(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.tasks.complete(req.user.userId, id);
  }

  @Patch(':id/reopen')
  reopen(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.tasks.reopen(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.tasks.remove(req.user.userId, id);
  }
}
