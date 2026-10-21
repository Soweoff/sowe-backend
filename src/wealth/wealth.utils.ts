export type Category =
  | 'IMOVEL'
  | 'DINHEIRO'
  | 'ACOES'
  | 'BANCO'
  | 'SKINS'
  | 'CRIPTO'
  | 'OUTROS';

export const CATEGORIES: Category[] = [
  'IMOVEL',
  'DINHEIRO',
  'ACOES',
  'BANCO',
  'SKINS',
  'CRIPTO',
  'OUTROS',
];

export type Currency = 'BRL' | 'USD';
export const CURRENCIES: Currency[] = ['BRL', 'USD'];

export const DEFAULT_GOAL_USD = 2_000_000;
export const DEFAULT_GOAL_DATE = '2028-01-07';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// `rate` = quantos reais valem 1 dólar (ex.: 5,02).
export function toUsd(amount: number, currency: string, rate: number): number {
  return currency === 'USD' ? amount : amount / rate;
}

// Quantos dias faltam de `from` até `to` (AAAA-MM-DD). Passou da data → 0.
export function daysLeft(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// Aceita só cotações plausíveis (evita lixo vindo de uma API fora do ar).
export function validRate(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 1 && n < 50 ? n : null;
}

export interface HoldingInput {
  id: number;
  category: string;
  label: string;
  amount: number;
  currency: string;
}

export interface Summary {
  goalUsd: number;
  deadline: string;
  daysLeft: number;
  rate: number;
  totalUsd: number;
  totalBrl: number;
  pct: number;
  remainingUsd: number;
  perMonthUsd: number;
  byCategory: { category: Category; usd: number; brl: number; share: number }[];
  holdings: (HoldingInput & { usd: number })[];
}

export function summarize(
  holdings: HoldingInput[],
  rate: number,
  goalUsd: number,
  today: string,
  deadline: string,
): Summary {
  const withUsd = holdings.map((h) => ({
    ...h,
    usd: round2(toUsd(h.amount, h.currency, rate)),
  }));
  const totalUsd = round2(withUsd.reduce((s, h) => s + h.usd, 0));
  const remainingUsd = round2(Math.max(0, goalUsd - totalUsd));
  const left = daysLeft(today, deadline);
  const months = left / 30.4375;

  const byCategory = CATEGORIES.map((category) => {
    const usd = round2(
      withUsd.filter((h) => h.category === category).reduce((s, h) => s + h.usd, 0),
    );
    return {
      category,
      usd,
      brl: round2(usd * rate),
      share: totalUsd > 0 ? round2((usd / totalUsd) * 100) : 0,
    };
  });

  return {
    goalUsd,
    deadline,
    daysLeft: left,
    rate,
    totalUsd,
    totalBrl: round2(totalUsd * rate),
    pct: round2((totalUsd / goalUsd) * 100),
    remainingUsd,
    perMonthUsd: months > 0 ? round2(remainingUsd / months) : remainingUsd,
    byCategory,
    holdings: withUsd,
  };
}
