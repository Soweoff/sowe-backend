// Funções puras da integração com o YouTube (fáceis de testar).

export interface ChannelMetrics {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  subscribers: number | null; // null quando o canal esconde os inscritos
  views: number;
  videos: number;
}

// Canais do estúdio (usados quando YOUTUBE_CHANNEL_IDS não está definida).
export const DEFAULT_CHANNEL_IDS = [
  'UCxwte-dvs1WgDN1okSweY3g',
  'UCYoE3K0i6DBznVicn7pOmww',
  'UCMQL_xF785CLONsDaASzUmQ',
];

export function parseChannelIds(raw: string | undefined): string[] {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^UC[\w-]{20,}$/.test(s));
  return ids.length ? [...new Set(ids)] : DEFAULT_CHANNEL_IDS;
}

interface YoutubeChannelItem {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

export function mapChannel(item: YoutubeChannelItem): ChannelMetrics {
  const stats = item.statistics ?? {};
  return {
    id: item.id ?? '',
    title: item.snippet?.title ?? '',
    handle: item.snippet?.customUrl ?? null,
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    subscribers: stats.hiddenSubscriberCount
      ? null
      : Number(stats.subscriberCount ?? 0),
    views: Number(stats.viewCount ?? 0),
    videos: Number(stats.videoCount ?? 0),
  };
}
