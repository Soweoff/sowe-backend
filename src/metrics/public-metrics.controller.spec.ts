import { BadRequestException } from '@nestjs/common';
import { PublicMetricsController } from './public-metrics.controller';
import { MetricsService, Payload } from './metrics.service';

const totals = {
  views: 10,
  minutesWatched: 120,
  subscribersGained: 3,
  subscribersLost: 1,
};

function makePayload(): Payload {
  return {
    updatedAt: '2026-10-25T00:00:00.000Z',
    days: 30,
    channels: [
      {
        id: 'UCabc',
        title: 'Canal',
        handle: '@canal',
        thumbnail: 'https://img/x.jpg',
        subscribers: 100,
        views: 5000,
        videos: 12,
        // Campos que NUNCA devem sair pela rota pública.
        secretField: 'não pode vazar',
        period: {
          current: { ...totals, estimatedRevenue: 999 },
          previous: { ...totals },
          daily: [{ date: '2026-10-24', views: 10, extra: 'x' }],
        },
      } as unknown as Payload['channels'][number],
    ],
  };
}

describe('PublicMetricsController', () => {
  function build(payload: Payload) {
    const service = {
      getYoutube: jest.fn().mockResolvedValue(payload),
    } as unknown as MetricsService;
    return { controller: new PublicMetricsController(service), service };
  }

  it('devolve só os campos permitidos', async () => {
    const { controller } = build(makePayload());
    const res = await controller.getYoutube('30');
    const channel = res.channels[0] as unknown as Record<string, unknown>;

    expect(Object.keys(channel).sort()).toEqual(
      [
        'handle',
        'id',
        'period',
        'subscribers',
        'thumbnail',
        'title',
        'videos',
        'views',
      ].sort(),
    );
    expect(channel).not.toHaveProperty('secretField');

    const period = channel.period as {
      current: Record<string, unknown>;
      daily: Record<string, unknown>[];
    };
    expect(Object.keys(period.current).sort()).toEqual(
      ['minutesWatched', 'subscribersGained', 'subscribersLost', 'views'].sort(),
    );
    expect(Object.keys(period.daily[0]).sort()).toEqual(['date', 'views']);
  });

  it('mantém period nulo quando o canal não autorizou o Analytics', async () => {
    const payload = makePayload();
    (payload.channels[0] as { period: unknown }).period = null;
    const { controller } = build(payload);
    const res = await controller.getYoutube();
    expect(res.channels[0].period).toBeNull();
  });

  it('usa 30 dias quando days não é informado', async () => {
    const { controller, service } = build(makePayload());
    await controller.getYoutube(undefined);
    expect(service.getYoutube).toHaveBeenCalledWith(30);
  });

  it('rejeita períodos fora de 30, 90 e 365', async () => {
    const { controller, service } = build(makePayload());
    await expect(controller.getYoutube('7')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.getYoutube).not.toHaveBeenCalled();
  });
});
