import { Injectable, Logger } from '@nestjs/common';
import { validRate } from './wealth.utils';

const TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;

async function fromErApi(): Promise<number | null> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { rates?: { BRL?: number } };
  return validRate(json.rates?.BRL);
}

async function fromAwesomeApi(): Promise<number | null> {
  const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { USDBRL?: { bid?: string } };
  return validRate(json.USDBRL?.bid);
}

export interface Rate {
  value: number;
  fetchedAt: string;
  stale: boolean;
}

// Cotação USD → BRL com cache de 30 min. Se as duas fontes falharem, usa a
// última cotação guardada (marcada como `stale`); sem nenhuma, devolve null.
@Injectable()
export class RateService {
  private readonly logger = new Logger(RateService.name);
  private cached: { value: number; at: number } | null = null;

  async get(): Promise<Rate | null> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < TTL_MS) return this.toRate(false);

    for (const source of [fromErApi, fromAwesomeApi]) {
      try {
        const value = await source();
        if (value) {
          this.cached = { value, at: now };
          return this.toRate(false);
        }
      } catch (err) {
        this.logger.warn(`Cotação: ${source.name} falhou (${(err as Error).message})`);
      }
    }
    return this.cached ? this.toRate(true) : null;
  }

  private toRate(stale: boolean): Rate {
    const c = this.cached!;
    return { value: c.value, fetchedAt: new Date(c.at).toISOString(), stale };
  }
}
