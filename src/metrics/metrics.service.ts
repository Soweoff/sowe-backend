import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ChannelMetrics,
  mapChannel,
  parseChannelIds,
} from './youtube.utils';

const CACHE_MS = 10 * 60 * 1000; // a cota da API é limitada: cache de 10 min
const TIMEOUT_MS = 10_000;

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cache: { at: number; data: ChannelMetrics[] } | null = null;

  async getYoutube() {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        'YOUTUBE_API_KEY não configurada na API.',
      );
    }

    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return { updatedAt: new Date(this.cache.at).toISOString(), channels: this.cache.data };
    }

    const ids = parseChannelIds(process.env.YOUTUBE_CHANNEL_IDS);
    const url =
      'https://www.googleapis.com/youtube/v3/channels' +
      `?part=snippet,statistics&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        this.logger.error(`YouTube API respondeu ${res.status}`);
        throw new Error(`status ${res.status}`);
      }
      const body = (await res.json()) as { items?: unknown[] };
      const data = (body.items ?? []).map((i) =>
        mapChannel(i as Parameters<typeof mapChannel>[0]),
      );
      this.cache = { at: Date.now(), data };
      return { updatedAt: new Date(this.cache.at).toISOString(), channels: data };
    } catch {
      // Se já temos dados antigos, é melhor mostrá-los do que falhar.
      if (this.cache) {
        return {
          updatedAt: new Date(this.cache.at).toISOString(),
          channels: this.cache.data,
          stale: true,
        };
      }
      throw new ServiceUnavailableException(
        'Não foi possível consultar o YouTube agora.',
      );
    }
  }
}
