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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateHoldingDto, UpdateHoldingDto } from './dto/holding.dto';
import { WealthService } from './wealth.service';

interface AuthedRequest {
  user: { userId: number };
}

@ApiBearerAuth()
@Controller('wealth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WealthController {
  constructor(private readonly wealth: WealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  summary(@Req() req: AuthedRequest) {
    return this.wealth.summary(req.user.userId);
  }

  @Post('holdings')
  create(@Req() req: AuthedRequest, @Body() body: CreateHoldingDto) {
    return this.wealth.create(req.user.userId, body);
  }

  @Patch('holdings/:id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateHoldingDto,
  ) {
    return this.wealth.update(req.user.userId, id, body);
  }

  @Delete('holdings/:id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.wealth.remove(req.user.userId, id);
  }
}
