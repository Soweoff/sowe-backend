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

// ---------------------------------------------------------------------------
// Períodos (YouTube Analytics API)
// ---------------------------------------------------------------------------

export const ALLOWED_PERIODS = [30, 90, 365] as const;
export type Period = (typeof ALLOWED_PERIODS)[number];

// Sem valor → 30 dias. Valor fora da lista → null (a rota responde 400).
export function parsePeriod(raw: string | undefined): Period | null {
  if (raw === undefined || raw === '') return 30;
  const n = Number(raw);
  return (ALLOWED_PERIODS as readonly number[]).includes(n)
    ? (n as Period)
    : null;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// O Analytics tem atraso de ~1 dia: o período termina ontem. Pedimos o dobro
// dos dias para também comparar com o período anterior.
export function buildRange(days: number, now: Date = new Date()) {
  const end = addDays(now, -1);
  const currentStart = addDays(end, -(days - 1));
  const start = addDays(end, -(days * 2 - 1));
  return {
    startDate: ymd(start),
    currentStart: ymd(currentStart),
    endDate: ymd(end),
  };
}

export interface PeriodTotals {
  views: number;
  minutesWatched: number;
  subscribersGained: number;
  subscribersLost: number;
}

export interface PeriodMetrics {
  current: PeriodTotals;
  previous: PeriodTotals;
  daily: { date: string; views: number }[];
}

const zero = (): PeriodTotals => ({
  views: 0,
  minutesWatched: 0,
  subscribersGained: 0,
  subscribersLost: 0,
});

// Linhas no formato da API: [dia, views, minutos, inscritos+, inscritos-].
export function summarizeRows(
  rows: (string | number)[][],
  days: number,
  range: { currentStart: string; endDate: string },
): PeriodMetrics {
  const current = zero();
  const previous = zero();
  const viewsByDay = new Map<string, number>();

  for (const row of rows) {
    const date = String(row[0]);
    const target = date >= range.currentStart ? current : previous;
    target.views += Number(row[1] ?? 0);
    target.minutesWatched += Number(row[2] ?? 0);
    target.subscribersGained += Number(row[3] ?? 0);
    target.subscribersLost += Number(row[4] ?? 0);
    if (date >= range.currentStart) viewsByDay.set(date, Number(row[1] ?? 0));
  }

  // Dias sem dado viram zero, para o gráfico ter sempre `days` pontos.
  const daily: { date: string; views: number }[] = [];
  const start = new Date(`${range.currentStart}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const date = ymd(addDays(start, i));
    daily.push({ date, views: viewsByDay.get(date) ?? 0 });
  }

  return { current, previous, daily };
}

// "UCabc=token1,UCdef=token2" → { UCabc: 'token1', UCdef: 'token2' }
export function parseTokens(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (raw ?? '').split(',')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const id = part.slice(0, i).trim();
    const token = part.slice(i + 1).trim();
    if (id && token) out[id] = token;
  }
  return out;
}
