import { RateLimitStore } from './rate-limit.store';
import { LoginThrottle } from './login-throttle';
import { securityHeaders } from './security-headers';
import { parseTrustProxyHops } from './trust-proxy';

const MIN = 60_000;

describe('RateLimitStore', () => {
  it('allows up to the limit, blocks the next and reports Retry-After', () => {
    let now = 0;
    const store = new RateLimitStore(() => now);

    for (let i = 1; i <= 3; i++) {
      const result = store.hit('k', 3, 10 * MIN);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3 - i);
    }

    now = 4 * MIN;

    const blocked = store.hit('k', 3, 10 * MIN);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(6 * 60);
  });

  it('reopens the window after it expires and isolates keys', () => {
    let now = 0;
    const store = new RateLimitStore(() => now);

    for (let i = 0; i < 4; i++) store.hit('a', 3, MIN);

    expect(store.hit('a', 3, MIN).allowed).toBe(false);
    expect(store.hit('b', 3, MIN).allowed).toBe(true);

    now = MIN;

    expect(store.hit('a', 3, MIN).allowed).toBe(true);
  });

  it('peek does not count and reset clears', () => {
    const store = new RateLimitStore(() => 0);

    store.hit('k', 2, MIN);
    expect(store.peek('k', 2).blocked).toBe(false);
    expect(store.peek('k', 2).blocked).toBe(false);

    store.hit('k', 2, MIN);
    expect(store.peek('k', 2).blocked).toBe(true);

    store.reset('k');
    expect(store.peek('k', 2).blocked).toBe(false);
  });

  it('never grows past maxKeys', () => {
    let now = 0;
    const store = new RateLimitStore(() => now, 100);

    for (let i = 0; i < 100; i++) store.hit(`k${i}`, 5, MIN);

    now = 2 * MIN;
    store.hit('novo', 5, MIN);
    expect(store.size).toBe(1);

    for (let i = 0; i < 500; i++) store.hit(`x${i}`, 5, 60 * MIN);
    expect(store.size).toBeLessThanOrEqual(100);
  });
});

describe('LoginThrottle', () => {
  it('blocks after 5 failures for the same account + IP and frees after 15 min', () => {
    let now = 0;
    const throttle = new LoginThrottle(new RateLimitStore(() => now));

    for (let i = 0; i < 5; i++) {
      expect(throttle.check('Admin@X.com', '1.1.1.1').blocked).toBe(false);
      throttle.recordFailure('Admin@X.com', '1.1.1.1');
    }

    const state = throttle.check('admin@x.com', '1.1.1.1');

    expect(state.blocked).toBe(true);
    expect(state.retryAfterSec).toBe(15 * 60);

    now = 15 * MIN;
    expect(throttle.check('admin@x.com', '1.1.1.1').blocked).toBe(false);
  });

  it('an attacker on another IP does not lock the owner out', () => {
    const throttle = new LoginThrottle(new RateLimitStore(() => 0));

    for (let i = 0; i < 5; i++) throttle.recordFailure('admin@x.com', '6.6.6.6');

    expect(throttle.check('admin@x.com', '6.6.6.6').blocked).toBe(true);
    expect(throttle.check('admin@x.com', '2.2.2.2').blocked).toBe(false);
  });

  it('rotating IPs does not help: the per-account cap blocks every IP', () => {
    let now = 0;
    const throttle = new LoginThrottle(new RateLimitStore(() => now));

    for (let i = 0; i < 30; i++) {
      throttle.recordFailure('admin@x.com', `10.0.0.${i}`);
    }

    expect(throttle.check('admin@x.com', '9.9.9.9').blocked).toBe(true);
    expect(throttle.check('outra@x.com', '9.9.9.9').blocked).toBe(false);

    now = 61 * MIN;
    expect(throttle.check('admin@x.com', '9.9.9.9').blocked).toBe(false);
  });

  it('a success clears the account + IP counter', () => {
    const throttle = new LoginThrottle(new RateLimitStore(() => 0));

    for (let i = 0; i < 4; i++) throttle.recordFailure('a@x.com', '1.1.1.1');

    throttle.recordSuccess('a@x.com', '1.1.1.1');

    for (let i = 0; i < 4; i++) throttle.recordFailure('a@x.com', '1.1.1.1');

    expect(throttle.check('a@x.com', '1.1.1.1').blocked).toBe(false);
  });

  it('users who all appear with the same IP are not affected by each other', () => {
    const throttle = new LoginThrottle(new RateLimitStore(() => 0));

    for (let i = 0; i < 10; i++) {
      throttle.recordFailure(`u${i}@x.com`, '172.0.0.1');
    }

    for (let i = 0; i < 10; i++) {
      expect(throttle.check(`u${i}@x.com`, '172.0.0.1').blocked).toBe(false);
    }
  });
});

describe('securityHeaders', () => {
  it('sets the security headers (and no CSP, to keep Swagger working)', () => {
    const headers: Record<string, string> = {};
    const next = jest.fn();

    securityHeaders(
      {} as never,
      { setHeader: (k: string, v: string) => (headers[k] = v) } as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Strict-Transport-Security']).toMatch(/^max-age=\d+$/);
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });
});

describe('parseTrustProxyHops', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['2', 2],
    ['0', 0],
    ['abc', 1],
    ['-3', 1],
    ['1.5', 1],
    ['99', 1],
  ])('%p -> %p', (input, expected) => {
    expect(parseTrustProxyHops(input as string | undefined)).toBe(expected);
  });
});
