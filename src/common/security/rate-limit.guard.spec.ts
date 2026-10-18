import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };

  function contextFor(ip: string, setHeader = jest.fn()) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          method: 'POST',
          path: '/v1/auth/login',
          route: { path: '/v1/auth/login' },
        }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
  }

  let guard: RateLimitGuard;

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
    guard = new RateLimitGuard(reflector as unknown as Reflector);
  });

  it('does nothing on routes without @RateLimit', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    for (let i = 0; i < 100; i++) {
      expect(guard.canActivate(contextFor('1.1.1.1'))).toBe(true);
    }
  });

  it('allows up to the limit and then answers 429 with Retry-After', () => {
    reflector.getAllAndOverride.mockReturnValue({ limit: 2, windowSec: 60 });
    const setHeader = jest.fn();

    expect(guard.canActivate(contextFor('1.1.1.1', setHeader))).toBe(true);
    expect(guard.canActivate(contextFor('1.1.1.1', setHeader))).toBe(true);

    let error: unknown;

    try {
      guard.canActivate(contextFor('1.1.1.1', setHeader));
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('keeps a separate counter for each IP', () => {
    reflector.getAllAndOverride.mockReturnValue({ limit: 1, windowSec: 60 });

    expect(guard.canActivate(contextFor('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(contextFor('2.2.2.2'))).toBe(true);
    expect(() => guard.canActivate(contextFor('1.1.1.1'))).toThrow(
      HttpException,
    );
  });
});
