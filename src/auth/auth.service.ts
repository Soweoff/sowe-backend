import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
} from '../common/prisma-errors';
import { LoginThrottle } from '../common/security/login-throttle';

@Injectable()
export class AuthService {
  // Estado em memória (zera quando a API reinicia). Ver rate-limit.store.ts.
  private readonly loginThrottle = new LoginThrottle();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private issueToken(user: { id: number; email: string; role: string }) {
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { access_token: token };
  }

  // Cadastro público: sempre cria com o papel USER e já devolve o token,
  // que é o que o frontend (AuthContext.register) espera receber.
  async register(data: RegisterDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          password: hashedPassword,
          role: 'USER',
        },
      });

      return this.issueToken(user);
    } catch (error) {
      if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
        throw new ConflictException('E-mail já cadastrado');
      }

      throw error;
    }
  }

  async login(data: LoginDto, ip = 'unknown') {
    const email = data.email.trim();

    // Depois de várias senhas erradas, nem chegamos a verificar a senha.
    const throttle = this.loginThrottle.check(email, ip);

    if (throttle.blocked) {
      const minutes = Math.max(1, Math.ceil(throttle.retryAfterSec / 60));

      throw new HttpException(
        `Muitas tentativas de login. Tente novamente em ${minutes} min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Busca sem diferenciar maiúsculas/minúsculas para não quebrar contas
    // antigas que foram gravadas com letras maiúsculas no e-mail.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    const isPasswordValid = user
      ? await bcrypt.compare(data.password, user.password)
      : false;

    if (!user || !isPasswordValid) {
      // E-mail inexistente também conta, para não revelar quais contas existem.
      this.loginThrottle.recordFailure(email, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginThrottle.recordSuccess(email, ip);

    return this.issueToken(user);
  }
}
