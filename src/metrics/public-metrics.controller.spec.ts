import { PublicMetricsController } from './public-metrics.controller';
import { MetricsService, PublicChannels } from './metrics.service';

function makePayload(): PublicChannels {
  return {
    updatedAt: '2026-10-25T00:00:00.000Z',
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
        period: { current: { minutesWatched: 120 } },
      } as unknown as PublicChannels['channels'][number],
    ],
  };
}

describe('PublicMetricsController', () => {
  function build(payload: PublicChannels) {
    const service = {
      getPublicChannels: jest.fn().mockResolvedValue(payload),
    } as unknown as MetricsService;
    return { controller: new PublicMetricsController(service), service };
  }

  it('devolve só os campos públicos do canal', async () => {
    const { controller } = build(makePayload());
    const res = await controller.getYoutube();
    const channel = res.channels[0] as unknown as Record<string, unknown>;

    expect(Object.keys(channel).sort()).toEqual(
      [
        'handle',
        'id',
        'subscribers',
        'thumbnail',
        'title',
        'videos',
        'views',
      ].sort(),
    );
    expect(channel).not.toHaveProperty('secretField');
    expect(channel).not.toHaveProperty('period');
  });

  it('mantém inscritos nulos quando o canal os esconde', async () => {
    const payload = makePayload();
    payload.channels[0].subscribers = null;
    const { controller } = build(payload);
    const res = await controller.getYoutube();
    expect(res.channels[0].subscribers).toBeNull();
  });

  it('repassa o aviso de dados em cache', async () => {
    const payload = { ...makePayload(), stale: true };
    const { controller } = build(payload);
    const res = await controller.getYoutube();
    expect(res.stale).toBe(true);
  });
});
