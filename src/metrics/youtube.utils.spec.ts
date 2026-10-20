import {
  ALLOWED_PERIODS,
  DEFAULT_CHANNEL_IDS,
  buildRange,
  mapChannel,
  parseChannelIds,
  parsePeriod,
  fingerprint,
  parseTokens,
  summarizeRows,
} from './youtube.utils';

describe('youtube.utils', () => {
  it('converte o item da API', () => {
    expect(
      mapChannel({
        id: 'UC1',
        snippet: { title: 'Canal', customUrl: '@canal', thumbnails: { default: { url: 'u' } } },
        statistics: { subscriberCount: '10', viewCount: '200', videoCount: '3' },
      }),
    ).toEqual({ id: 'UC1', title: 'Canal', handle: '@canal', thumbnail: 'u', subscribers: 10, views: 200, videos: 3 });
  });

  it('inscritos escondidos viram null', () => {
    expect(mapChannel({ statistics: { hiddenSubscriberCount: true, subscriberCount: '0' } }).subscribers).toBeNull();
  });

  it('usa os canais padrão quando a variável está vazia ou inválida', () => {
    expect(parseChannelIds(undefined)).toEqual(DEFAULT_CHANNEL_IDS);
    expect(parseChannelIds('abc, ')).toEqual(DEFAULT_CHANNEL_IDS);
  });

  it('aceita lista separada por vírgula sem repetir', () => {
    const a = 'UCxwte-dvs1WgDN1okSweY3g';
    expect(parseChannelIds(`${a}, ${a}`)).toEqual([a]);
  });
});

describe('períodos', () => {
  it('parsePeriod', () => {
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod('90')).toBe(90);
    expect(parsePeriod('7')).toBeNull();
    expect(ALLOWED_PERIODS).toEqual([30, 90, 365]);
  });

  it('buildRange termina ontem e cobre o dobro dos dias', () => {
    const r = buildRange(30, new Date('2026-10-20T15:00:00Z'));
    expect(r).toEqual({ startDate: '2026-08-21', currentStart: '2026-09-20', endDate: '2026-10-19' });
  });

  it('summarizeRows separa atual e anterior e preenche dias vazios', () => {
    const range = { currentStart: '2026-10-18', endDate: '2026-10-19' };
    const m = summarizeRows(
      [['2026-10-16', 5, 10, 1, 0], ['2026-10-19', 7, 20, 2, 1]],
      2,
      range,
    );
    expect(m.previous.views).toBe(5);
    expect(m.current).toEqual({ views: 7, minutesWatched: 20, subscribersGained: 2, subscribersLost: 1 });
    expect(m.daily).toEqual([{ date: '2026-10-18', views: 0 }, { date: '2026-10-19', views: 7 }]);
  });

  it('parseTokens', () => {
    expect(parseTokens('UCa=1//x, UCb=y')).toEqual({ UCa: '1//x', UCb: 'y' });
    expect(parseTokens(undefined)).toEqual({});
    expect(parseTokens('semigual')).toEqual({});
  });
});

describe('tolerância de colagem', () => {
  it('remove aspas, espaços e o prefixo YOUTUBE_TOKENS=', () => {
    expect(parseTokens('YOUTUBE_TOKENS="UCa=1//x y"\n, \'UCb\'= z ')).toEqual({
      UCa: '1//xy',
      UCb: 'z',
    });
  });

  it('fingerprint não revela o valor inteiro', () => {
    expect(fingerprint('1//0abcdefghijWXYZ')).toBe('len=18 inicio=1//0 fim=WXYZ');
    expect(fingerprint(undefined)).toBe('vazio');
  });
});
