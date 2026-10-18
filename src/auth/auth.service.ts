import {
  ConflictException,
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

@Injectable()
export class AuthService {
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

  async login(data: LoginDto) {
    // Busca sem diferenciar maiúsculas/minúsculas para não quebrar contas
    // antigas que foram gravadas com letras maiúsculas no e-mail.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: data.email.trim(), mode: 'insensitive' } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user);
  }
}
