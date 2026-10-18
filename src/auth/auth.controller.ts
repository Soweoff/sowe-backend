import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RateLimit,
  RateLimitGuard,
} from '../common/security/rate-limit.guard';

@Controller({ path: 'auth', version: '1' })
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  // Respostas com token nunca devem ficar em cache.
  @Post('register')
  @RateLimit({ limit: 10, windowSec: 60 * 60 })
  @Header('Cache-Control', 'no-store')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @RateLimit({ limit: 60, windowSec: 15 * 60 })
  @Header('Cache-Control', 'no-store')
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(body, req.ip);
  }
}
