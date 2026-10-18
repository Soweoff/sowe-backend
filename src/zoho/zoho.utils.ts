// Funções puras (sem dependências do Nest) usadas pelo ZohoService.
// Ficam separadas para serem fáceis de testar.

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/**
 * Converte uma data para o formato do Zoho (yyyyMMddTHHmmss-0300).
 *
 * - "2026-10-17T14:30" (o que o <input type="datetime-local"> envia) é tratado
 *   como horário de Brasília, sem depender do fuso do servidor (o Render roda
 *   em UTC).
 * - Datas com "Z" ou offset (ex.: toISOString) são convertidas para
 *   America/Sao_Paulo.
 */
export function toZohoFormat(value: string): string {
  const trimmed = value.trim();
  const local = LOCAL_DATE_TIME.exec(trimmed);

  if (local) {
    const [, y, m, d, h, min] = local;
    return `${y}${m}${d}T${h}${min}00-0300`;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Data inválida: ${value}`);
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)!.value;

  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}00-0300`;
}

/**
 * Lê o tempo de vida do access token na resposta do Zoho.
 * Aceita segundos ou milissegundos e nunca passa de 1 hora (padrão do Zoho).
 */
export function parseExpiresInSec(data: {
  expires_in_sec?: number | string;
  expires_in?: number | string;
}): number {
  const raw = Number(data?.expires_in_sec ?? data?.expires_in ?? 3600);
  const seconds = raw > 100_000 ? raw / 1000 : raw;

  if (!Number.isFinite(seconds) || seconds <= 0) return 3600;

  return Math.min(seconds, 3600);
}

export interface FetchedToken {
  token: string;
  expiresInSec: number;
}

/**
 * Guarda o access token em memória até perto de expirar.
 *
 * Por que isso importa: o Zoho limita quantos access tokens cada refresh
 * token pode gerar em poucos minutos. Pedir um token novo a cada requisição
 * (como era feito antes) estoura esse limite e causa falhas intermitentes.
 * Também junta chamadas simultâneas numa só (`inflight`).
 */
export class AccessTokenCache {
  private token: string | null = null;
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly safetyMarginMs = 60_000,
  ) {}

  async get(fetcher: () => Promise<FetchedToken>): Promise<string> {
    if (this.token && this.now() < this.expiresAt) return this.token;

    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const { token, expiresInSec } = await fetcher();

        this.token = token;
        this.expiresAt = this.now() + expiresInSec * 1000 - this.safetyMarginMs;

        return token;
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }

  invalidate() {
    this.token = null;
    this.expiresAt = 0;
  }
}

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ERR_NETWORK',
]);

/** Erros que valem uma nova tentativa: rede instável, 429 e erros 5xx. */
export function isTransientError(error: any): boolean {
  const status = error?.response?.status;

  if (typeof status === 'number') return status === 429 || status >= 500;

  return TRANSIENT_NETWORK_CODES.has(error?.code);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    baseDelayMs: number;
    shouldRetry: (error: any) => boolean;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= options.retries || !options.shouldRetry(error)) {
        throw error;
      }

      attempt += 1;
      await sleep(options.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
