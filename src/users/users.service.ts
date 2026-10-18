import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  isPrismaError,
  PRISMA_RECORD_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
} from '../common/prisma-errors';

// Nunca devolvemos o hash da senha em nenhuma resposta.
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    return user;
  }

  async create(data: CreateUserDto) {
    const password = await bcrypt.hash(data.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          password,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
        throw new ConflictException('E-mail já cadastrado');
      }

      throw error;
    }
  }

  async update(id: number, data: UpdateUserDto) {
    const { password, email, name, role } = data;

    const updateData: Prisma.UserUpdateInput = {};

    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (role !== undefined) updateData.role = role;
    if (password !== undefined) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: publicUserSelect,
      });
    } catch (error) {
      if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) {
        throw new NotFoundException('Usuário não encontrado');
      }

      if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
        throw new ConflictException('E-mail já cadastrado');
      }

      throw error;
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.user.delete({
        where: { id },
        select: publicUserSelect,
      });
    } catch (error) {
      if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) {
        throw new NotFoundException('Usuário não encontrado');
      }

      throw error;
    }
  }
}
