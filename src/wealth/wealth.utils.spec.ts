import { daysLeft, summarize, toUsd, validRate } from './wealth.utils';

describe('wealth.utils', () => {
  it('conta os dias até 07/01/2028 a partir de 21/10/2026', () => {
    expect(daysLeft('2026-10-21', '2028-01-07')).toBe(443);
    expect(daysLeft('2028-01-07', '2028-01-07')).toBe(0);
    expect(daysLeft('2028-02-01', '2028-01-07')).toBe(0);
  });

  it('converte reais em dólares pela cotação', () => {
    expect(toUsd(5000, 'BRL', 5)).toBe(1000);
    expect(toUsd(300, 'USD', 5)).toBe(300);
  });

  it('só aceita cotações plausíveis', () => {
    expect(validRate('5.02')).toBe(5.02);
    expect(validRate(0)).toBeNull();
    expect(validRate('abc')).toBeNull();
    expect(validRate(500)).toBeNull();
    expect(validRate(undefined)).toBeNull();
  });

  it('resume progresso, falta e distribuição por categoria', () => {
    const s = summarize(
      [
        { id: 1, category: 'IMOVEL', label: 'Apto', amount: 500000, currency: 'BRL' },
        { id: 2, category: 'CRIPTO', label: 'BTC', amount: 100000, currency: 'USD' },
        { id: 3, category: 'BANCO', label: 'CDB', amount: 500000, currency: 'BRL' },
      ],
      5,
      2_000_000,
      '2026-10-21',
      '2028-01-07',
    );
    expect(s.totalUsd).toBe(300000);
    expect(s.totalBrl).toBe(1500000);
    expect(s.pct).toBe(15);
    expect(s.remainingUsd).toBe(1700000);
    expect(s.daysLeft).toBe(443);
    expect(s.perMonthUsd).toBeCloseTo(1700000 / (443 / 30.4375), 0);
    expect(s.byCategory.find((c) => c.category === 'IMOVEL')).toEqual({
      category: 'IMOVEL',
      usd: 100000,
      brl: 500000,
      share: 33.33,
    });
    expect(s.byCategory.find((c) => c.category === 'SKINS')?.usd).toBe(0);
  });

  it('sem valores cadastrados tudo fica zerado, e meta batida zera a falta', () => {
    const empty = summarize([], 5, 2_000_000, '2026-10-21', '2028-01-07');
    expect(empty.pct).toBe(0);
    expect(empty.byCategory.every((c) => c.share === 0)).toBe(true);
    const done = summarize(
      [{ id: 1, category: 'ACOES', label: 'X', amount: 2_500_000, currency: 'USD' }],
      5, 2_000_000, '2026-10-21', '2028-01-07',
    );
    expect(done.remainingUsd).toBe(0);
    expect(done.pct).toBe(125);
  });
});
