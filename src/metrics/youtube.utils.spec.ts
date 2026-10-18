import { mapChannel, parseChannelIds, DEFAULT_CHANNEL_IDS } from './youtube.utils';

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
