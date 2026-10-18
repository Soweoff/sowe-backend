import { RateLimitStore } from './rate-limit.store';

// Limita tentativas de login FALHAS. Duas camadas, de propósito:
//
//  1. conta + IP: poucas falhas (padrão 5 em 15 min). Quem erra a senha de
//     longe não derruba o acesso do dono da conta em outro lugar.
//  2. só conta: teto maior (padrão 30 em 1 h), que vale mesmo se o atacante
//     trocar de IP ou falsificar o cabeçalho X-Forwarded-For.
//
// Assim a proteção da senha não depende de a API saber o IP real do cliente.

export interface LoginThrottleOptions {
  perAccountIpLimit: number;
  perAccountIpWindowMs: number;
  perAccountLimit: number;
  perAccountWindowMs: number;
}

const DEFAULTS: LoginThrottleOptions = {
  perAccountIpLimit: 5,
  perAccountIpWindowMs: 15 * 60_000,
  perAccountLimit: 30,
  perAccountWindowMs: 60 * 60_000,
};

export interface ThrottleState {
  blocked: boolean;
  retryAfterSec: number;
}

export class LoginThrottle {
  private readonly options: LoginThrottleOptions;

  constructor(
    private readonly store: RateLimitStore = new RateLimitStore(),
    options: Partial<LoginThrottleOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  private keys(email: string, ip: string) {
    const account = email.trim().toLowerCase();

    return {
      pair: `login:pair:${account}|${ip}`,
      account: `login:account:${account}`,
    };
  }

  /** Chame ANTES de verificar a senha. */
  check(email: string, ip: string): ThrottleState {
    const keys = this.keys(email, ip);

    const pair = this.store.peek(keys.pair, this.options.perAccountIpLimit);
    const account = this.store.peek(keys.account, this.options.perAccountLimit);

    return {
      blocked: pair.blocked || account.blocked,
      retryAfterSec: Math.max(pair.retryAfterSec, account.retryAfterSec),
    };
  }

  recordFailure(email: string, ip: string) {
    const keys = this.keys(email, ip);

    this.store.hit(
      keys.pair,
      this.options.perAccountIpLimit,
      this.options.perAccountIpWindowMs,
    );
    this.store.hit(
      keys.account,
      this.options.perAccountLimit,
      this.options.perAccountWindowMs,
    );
  }

  /** Login certo zera só o contador "conta + IP". */
  recordSuccess(email: string, ip: string) {
    this.store.reset(this.keys(email, ip).pair);
  }
}
