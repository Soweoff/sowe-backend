import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { parsePeriod } from './youtube.utils';

// Métricas dos canais para a página pública /youtube do site.
//
// Esta rota NÃO exige login. Por isso ela devolve só uma lista fixa de campos
// (montada abaixo, campo a campo) em vez de repassar o objeto do serviço: se o
// painel interno ganhar um dado novo e privado, ele não vai parar aqui sem
// alguém decidir isso de propósito.
//
// Os dados vêm do mesmo serviço do painel admin, que guarda o resultado em
// cache por 10 minutos. Então muitos visitantes não gastam a cota da API.
@ApiTags('public')
@Controller('public/metrics')
export class PublicMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('youtube')
  async getYoutube(@Query('days') days?: string) {
    const period = parsePeriod(days);
    if (period === null) {
      throw new BadRequestException('days deve ser 30, 90 ou 365.');
    }

    const data = await this.metricsService.getYoutube(period);

    return {
      updatedAt: data.updatedAt,
      days: data.days,
      stale: data.stale,
      channels: data.channels.map((c) => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
        thumbnail: c.thumbnail,
        subscribers: c.subscribers,
        views: c.views,
        videos: c.videos,
        period: c.period
          ? {
              current: pickTotals(c.period.current),
              previous: pickTotals(c.period.previous),
              daily: c.period.daily.map((d) => ({
                date: d.date,
                views: d.views,
              })),
            }
          : null,
      })),
    };
  }
}

function pickTotals(t: {
  views: number;
  minutesWatched: number;
  subscribersGained: number;
  subscribersLost: number;
}) {
  return {
    views: t.views,
    minutesWatched: t.minutesWatched,
    subscribersGained: t.subscribersGained,
    subscribersLost: t.subscribersLost,
  };
}
