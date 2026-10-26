import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

// Dados dos canais para a página pública /youtube do site.
//
// Esta rota NÃO exige login. Por isso ela devolve só o que o próprio YouTube
// já mostra para qualquer pessoa (nome, foto, inscritos, views e vídeos), e a
// resposta é montada campo a campo: se o painel interno ganhar um dado novo e
// privado, ele não vai parar aqui sem alguém decidir isso de propósito.
//
// Os números do Analytics (horas assistidas, inscritos ganhos, período) ficam
// só na rota do painel admin (/metrics/youtube).
@ApiTags('public')
@Controller('public/metrics')
export class PublicMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('youtube')
  async getYoutube() {
    const data = await this.metricsService.getPublicChannels();

    return {
      updatedAt: data.updatedAt,
      stale: data.stale,
      channels: data.channels.map((c) => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
        thumbnail: c.thumbnail,
        subscribers: c.subscribers,
        views: c.views,
        videos: c.videos,
      })),
    };
  }
}
