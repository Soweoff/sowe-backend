// Contador em memória por "janela fixa". Sem dependências, fácil de testar.
//
// Limitação conhecida: o estado vive só na memória deste processo. Isso basta
// para uma única instância (como o plano do Render usado hoje) e zera quando a
// API reinicia ou hiberna. Se a API passar a rodar com várias instâncias, troque
// por um armazenamento compartilhado (ex.: Redis).

export interface HitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface PeekResult {
  blocked: boolean;
  retryAfterSec: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

export class RateLimitStore {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 50_000,
  ) {}

  /** Conta uma ocorrência e informa se ainda está dentro do limite. */
  hit(key: string, limit: number, windowMs: number): HitResult {
    const now = this.now();
    let entry = this.entries.get(key);

    if (!entry || entry.resetAt <= now) {
      this.prune(now);
      entry = { count: 0, resetAt: now + windowMs };
      this.entries.set(key, entry);
    }

    entry.count += 1;

    const allowed = entry.count <= limit;

    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSec: allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  /** Consulta sem contar: já atingiu o limite nesta janela? */
  peek(key: string, limit: number): PeekResult {
    const now = this.now();
    const entry = this.entries.get(key);

    if (!entry || entry.resetAt <= now || entry.count < limit) {
      return { blocked: false, retryAfterSec: 0 };
    }

    return {
      blocked: true,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  reset(key: string) {
    this.entries.delete(key);
  }

  get size() {
    return this.entries.size;
  }

  // Evita crescer sem limite: só limpa quando a tabela está cheia.
  private prune(now: number) {
    if (this.entries.size < this.maxKeys) return;

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }

    if (this.entries.size >= this.maxKeys) this.entries.clear();
  }
}
