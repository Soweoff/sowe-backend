import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ChannelMetrics,
  PeriodMetrics,
  buildRange,
  mapChannel,
  parseChannelIds,
  parseTokens,
} from './youtube.utils';
import { fetchPeriod } from './youtube-analytics';

const CACHE_MS = 10 * 60 * 1000; // a cota das APIs é limitada: cache de 10 min
const TIMEOUT_MS = 10_000;

export type ChannelWithPeriod = ChannelMetrics & { period: PeriodMetrics | null };
export interface Payload {
  updatedAt: string;
  days: number;
  channels: ChannelWithPeriod[];
  stale?: boolean;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cache = new Map<number, { at: number; data: Payload }>();

  async getYoutube(days: number): Promise<Payload> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        'YOUTUBE_API_KEY não configurada na API.',
      );
    }

    const hit = this.cache.get(days);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

    try {
      const channels = await this.fetchChannels(key);
      const tokens = parseTokens(process.env.YOUTUBE_TOKENS);
      const range = buildRange(days);

      const withPeriod = await Promise.all(
        channels.map(async (c) => ({
          ...c,
          period: await fetchPeriod(c.id, tokens[c.id], days, range),
        })),
      );

      const data: Payload = {
        updatedAt: new Date().toISOString(),
        days,
        channels: withPeriod,
      };
      this.cache.set(days, { at: Date.now(), data });
      return data;
    } catch {
      // Se já temos dados antigos, é melhor mostrá-los do que falhar.
      if (hit) return { ...hit.data, stale: true };
      throw new ServiceUnavailableException(
        'Não foi possível consultar o YouTube agora.',
      );
    }
  }

  private async fetchChannels(key: string): Promise<ChannelMetrics[]> {
    const ids = parseChannelIds(process.env.YOUTUBE_CHANNEL_IDS);
    const url =
      'https://www.googleapis.com/youtube/v3/channels' +
      `?part=snippet,statistics&id=${ids.join(',')}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      this.logger.error(`YouTube API respondeu ${res.status}`);
      throw new Error(`status ${res.status}`);
    }
    const body = (await res.json()) as { items?: unknown[] };
    return (body.items ?? []).map((i) =>
      mapChannel(i as Parameters<typeof mapChannel>[0]),
    );
  }
}
