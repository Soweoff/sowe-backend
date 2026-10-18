import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 1, name: 'Everton', email: 'everton@email.com', role: 'ADMIN' },
        ]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should return all users', async () => {
    const users = await service.findAll();
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Everton');
  });

  it('never selects the password hash', async () => {
    await service.findAll();

    const { select } = mockPrisma.user.findMany.mock.calls[0][0];

    expect(select).toEqual({ id: true, name: true, email: true, role: true });
    expect(select.password).toBeUndefined();
  });

  it('findOne throws NotFound when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('create stores a bcrypt hash, not the plain password', async () => {
    mockPrisma.user.create.mockResolvedValue({ id: 3 });

    await service.create({
      name: 'Cliente',
      email: 'Cliente@Email.com',
      password: 'segredo123',
    });

    const arg = mockPrisma.user.create.mock.calls[0][0];

    expect(arg.data).toEqual({
      name: 'Cliente',
      email: 'cliente@email.com',
      password: 'hashed',
    });
    expect(arg.select.password).toBeUndefined();
  });

  it('create returns 409 when the e-mail already exists', async () => {
    mockPrisma.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({ name: 'A', email: 'a@a.com', password: '123456' }),
    ).rejects.toThrow(ConflictException);
  });

  it('update hashes a new password and only sends known fields', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 1 });

    await service.update(1, { password: 'novasenha1', role: 'ADMIN' });

    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
      password: 'hashed',
      role: 'ADMIN',
    });
  });

  it('update returns 404 when the user does not exist', async () => {
    mockPrisma.user.update.mockRejectedValue({ code: 'P2025' });

    await expect(service.update(99, { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove returns 404 when the user does not exist', async () => {
    mockPrisma.user.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.remove(99)).rejects.toThrow(NotFoundException);
  });
});
