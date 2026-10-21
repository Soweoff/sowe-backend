import {
  encodeEventId,
  AccessTokenCache,
  isTransientError,
  parseExpiresInSec,
  toZohoFormat,
  withRetry,
} from './zoho.utils';

describe('toZohoFormat', () => {
  it('treats datetime-local values as Brasília time, whatever the server TZ', () => {
    expect(toZohoFormat('2026-10-17T14:30')).toBe('20261017T143000-0300');
    expect(toZohoFormat('2026-10-17 09:05')).toBe('20261017T090500-0300');
  });

  it('converts absolute instants (Z) to America/Sao_Paulo', () => {
    expect(toZohoFormat('2026-10-17T17:30:00.000Z')).toBe(
      '20261017T143000-0300',
    );
    expect(toZohoFormat('2026-10-17T00:30:00Z')).toBe('20261016T213000-0300');
  });

  it('throws RangeError for invalid dates', () => {
    expect(() => toZohoFormat('abc')).toThrow(RangeError);
  });
});

describe('parseExpiresInSec', () => {
  it('accepts seconds or milliseconds and caps at one hour', () => {
    expect(parseExpiresInSec({ expires_in_sec: 3600 })).toBe(3600);
    expect(parseExpiresInSec({ expires_in: 3600000 })).toBe(3600);
    expect(parseExpiresInSec({ expires_in: 600 })).toBe(600);
    expect(parseExpiresInSec({})).toBe(3600);
  });
});

describe('AccessTokenCache', () => {
  it('reuses the token until close to expiry', async () => {
    let clock = 0;
    let calls = 0;
    const cache = new AccessTokenCache(() => clock, 60_000);
    const fetcher = async () => ({ token: `t${++calls}`, expiresInSec: 3600 });

    expect(await cache.get(fetcher)).toBe('t1');
    expect(await cache.get(fetcher)).toBe('t1');
    expect(calls).toBe(1);

    clock = 3_541_000;
    expect(await cache.get(fetcher)).toBe('t2');
  });

  it('shares one request between simultaneous callers', async () => {
    let calls = 0;
    const cache = new AccessTokenCache();
    const fetcher = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { token: 'abc', expiresInSec: 3600 };
    };

    const tokens = await Promise.all([
      cache.get(fetcher),
      cache.get(fetcher),
      cache.get(fetcher),
    ]);

    expect(tokens).toEqual(['abc', 'abc', 'abc']);
    expect(calls).toBe(1);
  });

  it('does not stay stuck after a failure and can be invalidated', async () => {
    const cache = new AccessTokenCache();

    await expect(
      cache.get(async () => {
        throw new Error('falhou');
      }),
    ).rejects.toThrow('falhou');

    expect(
      await cache.get(async () => ({ token: 'ok', expiresInSec: 3600 })),
    ).toBe('ok');

    cache.invalidate();

    expect(
      await cache.get(async () => ({ token: 'novo', expiresInSec: 3600 })),
    ).toBe('novo');
  });
});

describe('withRetry / isTransientError', () => {
  const noSleep = async () => undefined;

  it('retries transient errors with exponential backoff', async () => {
    const waits: number[] = [];
    let calls = 0;

    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw { response: { status: 503 } };
        return 'sucesso';
      },
      {
        retries: 2,
        baseDelayMs: 400,
        shouldRetry: isTransientError,
        sleep: async (ms) => void waits.push(ms),
      },
    );

    expect(result).toBe('sucesso');
    expect(waits).toEqual([400, 800]);
  });

  it('does not retry client errors such as 400', async () => {
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls++;
          throw { response: { status: 400 } };
        },
        {
          retries: 2,
          baseDelayMs: 1,
          shouldRetry: isTransientError,
          sleep: noSleep,
        },
      ),
    ).rejects.toBeDefined();

    expect(calls).toBe(1);
  });

  it('classifies errors', () => {
    expect(isTransientError({ response: { status: 429 } })).toBe(true);
    expect(isTransientError({ response: { status: 502 } })).toBe(true);
    expect(isTransientError({ response: { status: 401 } })).toBe(false);
    expect(isTransientError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isTransientError(new Error('x'))).toBe(false);
  });
});

describe('encodeEventId', () => {
  it('mantém o @ literal (o Zoho recusa %40)', () => {
    expect(encodeEventId('ce88daf5661c4a73b149b11d2cd25eb8@zoho.com')).toBe(
      'ce88daf5661c4a73b149b11d2cd25eb8@zoho.com',
    );
  });

  it('continua codificando caracteres perigosos', () => {
    expect(encodeEventId('a/b?c#d')).toBe('a%2Fb%3Fc%23d');
  });
});
