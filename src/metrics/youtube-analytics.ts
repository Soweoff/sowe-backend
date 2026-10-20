import { Logger } from '@nestjs/common';
import { PeriodMetrics, fingerprint, summarizeRows } from './youtube.utils';

const TIMEOUT_MS = 10_000;
const logger = new Logger('YoutubeAnalytics');

// Cache do access token (dura ~1 h) por refresh token.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('credenciais Google ausentes');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Só o código do erro (ex.: invalid_grant), nunca o token.
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`oauth ${res.status} ${body.error ?? ''}`.trim());
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(refreshToken, {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  });
  return body.access_token;
}

// Devolve null (sem derrubar a tela) se o canal não tiver acesso configurado
// ou se o Google falhar: os números "de sempre" continuam aparecendo.
export async function fetchPeriod(
  channelId: string,
  refreshToken: string | undefined,
  days: number,
  range: { startDate: string; currentStart: string; endDate: string },
): Promise<PeriodMetrics | null> {
  if (!refreshToken) return null;
  try {
    const accessToken = await getAccessToken(refreshToken);
    const qs = new URLSearchParams({
      ids: `channel==${channelId}`,
      startDate: range.startDate,
      endDate: range.endDate,
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
      dimensions: 'day',
      sort: 'day',
    });
    const res = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?${qs}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) throw new Error(`analytics ${res.status}`);
    const body = (await res.json()) as { rows?: (string | number)[][] };
    return summarizeRows(body.rows ?? [], days, range);
  } catch (err) {
    logger.warn(
      `Período indisponível para ${channelId}: ${(err as Error).message} ` +
        `[token ${fingerprint(refreshToken)}] ` +
        `[client_id ${fingerprint(process.env.GOOGLE_CLIENT_ID)}] ` +
        `[secret len=${(process.env.GOOGLE_CLIENT_SECRET ?? '').length}]`,
    );
    return null;
  }
}
