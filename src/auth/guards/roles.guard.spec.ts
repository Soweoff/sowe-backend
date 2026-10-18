import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function contextFor(user?: { role?: string }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => reflector.getAllAndOverride.mockReset());

  it('allows any authenticated user when no role is required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextFor({ role: 'USER' }))).toBe(true);
  });

  it('allows an ADMIN on an ADMIN-only route', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(contextFor({ role: 'ADMIN' }))).toBe(true);
  });

  it('blocks a USER on an ADMIN-only route', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(contextFor({ role: 'USER' }))).toBe(false);
  });

  it('blocks when request.user has no role (regression: JwtStrategy)', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(contextFor({}))).toBe(false);
  });

  it('blocks when there is no user at all', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });
});
