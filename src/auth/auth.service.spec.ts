import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('fake-jwt-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should login successfully and put the role in the token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: 'everton@email.com',
        password: 'hashed-password',
        role: 'ADMIN',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'everton@email.com',
        password: '123456',
      });

      expect(result).toEqual({ access_token: 'fake-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'everton@email.com',
        role: 'ADMIN',
      });
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'naoexiste@email.com',
          password: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw error if password is wrong', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: 'everton@email.com',
        password: 'hashed-password',
        role: 'USER',
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'everton@email.com', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login throttle', () => {
    const user = {
      id: 1,
      email: 'a@a.com',
      password: 'hashed-password',
      role: 'USER',
    };

    const wrongLogin = (ip: string) =>
      service.login({ email: 'a@a.com', password: 'errada' }, ip);

    it('blocks with 429 after 5 wrong passwords and stops querying the database', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      for (let i = 0; i < 5; i++) {
        await expect(wrongLogin('1.1.1.1')).rejects.toThrow(
          UnauthorizedException,
        );
      }

      mockPrisma.user.findFirst.mockClear();

      const error = await wrongLogin('1.1.1.1').catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('does not lock the account owner out from another IP', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      for (let i = 0; i < 5; i++) {
        await expect(wrongLogin('6.6.6.6')).rejects.toThrow();
      }

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(
        { email: 'a@a.com', password: 'certa' },
        '2.2.2.2',
      );

      expect(result).toEqual({ access_token: 'fake-jwt-token' });
    });

    it('counts unknown e-mails too, so accounts cannot be enumerated', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      for (let i = 0; i < 5; i++) {
        await expect(wrongLogin('1.1.1.1')).rejects.toThrow(
          UnauthorizedException,
        );
      }

      const error = await wrongLogin('1.1.1.1').catch((e) => e);

      expect((error as HttpException).getStatus()).toBe(429);
    });

    it('a successful login clears the failure counter', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      for (let i = 0; i < 4; i++) {
        await expect(wrongLogin('1.1.1.1')).rejects.toThrow();
      }

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await service.login({ email: 'a@a.com', password: 'certa' }, '1.1.1.1');

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      for (let i = 0; i < 4; i++) {
        await expect(wrongLogin('1.1.1.1')).rejects.toThrow(
          UnauthorizedException,
        );
      }
    });
  });

  describe('register', () => {
    it('should create a USER with hashed password and return a token', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrisma.user.create.mockResolvedValue({
        id: 2,
        email: 'novo@email.com',
        role: 'USER',
      });

      const result = await service.register({
        name: '  Novo  ',
        email: 'Novo@Email.com',
        password: '123456',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Novo',
          email: 'novo@email.com',
          password: 'hashed',
          role: 'USER',
        },
      });
      expect(result).toEqual({ access_token: 'fake-jwt-token' });
    });

    it('should return 409 when the e-mail already exists', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrisma.user.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.register({
          name: 'Novo',
          email: 'existe@email.com',
          password: '123456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
