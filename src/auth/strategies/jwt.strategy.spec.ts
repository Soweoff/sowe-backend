import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configWith = (secret?: string) =>
    ({ get: jest.fn().mockReturnValue(secret) }) as unknown as ConfigService;

  it('exposes userId, email AND role on request.user', () => {
    const strategy = new JwtStrategy(configWith('segredo-de-teste'));

    expect(
      strategy.validate({ sub: 7, email: 'admin@email.com', role: 'ADMIN' }),
    ).toEqual({ userId: 7, email: 'admin@email.com', role: 'ADMIN' });
  });

  it('refuses to start without JWT_SECRET', () => {
    expect(() => new JwtStrategy(configWith(undefined))).toThrow(
      'JWT_SECRET não configurado',
    );
  });
});
