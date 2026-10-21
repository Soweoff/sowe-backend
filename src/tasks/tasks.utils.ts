import { addDaysLocal, toLocalBrt } from '../booking/booking.utils';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EPIC';

export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'EPIC'];

export const DIFFICULTY_XP: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 40,
  EPIC: 80,
};

export interface LevelInfo {
  level: number;
  xp: number;
  // XP já acumulado dentro do nível atual e o necessário para o próximo.
  into: number;
  needed: number;
}

// Nível n começa em 50·(n-1)² XP: 0, 50, 200, 450, 800...
export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safe / 50)) + 1;
  const start = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, xp: safe, into: safe - start, needed: next - start };
}

// Dia (AAAA-MM-DD) em Brasília.
export function dayKey(date: Date): string {
  return toLocalBrt(date).slice(0, 10);
}

export interface DoneItem {
  doneAt: Date;
  xp: number;
}

// Sequência atual: dias seguidos com ao menos uma missão concluída.
// Se hoje ainda não teve nenhuma, a sequência continua valendo a partir de ontem.
export function computeStreaks(
  days: Iterable<string>,
  today: string,
): { current: number; best: number } {
  const set = new Set(days);
  const sorted = [...set].sort();

  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && addDaysLocal(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }

  let cursor = set.has(today) ? today : addDaysLocal(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDaysLocal(cursor, -1);
  }
  return { current, best };
}

export interface ReportTask {
  id: number;
  title: string;
  difficulty: string;
  xp: number;
  doneAt: Date;
}

export interface Report {
  days: number;
  completed: number;
  xp: number;
  byDay: { date: string; count: number; xp: number }[];
  byDifficulty: Record<Difficulty, number>;
  items: {
    id: number;
    title: string;
    difficulty: string;
    xp: number;
    doneAt: string;
  }[];
}

// Relatório dos últimos `days` dias (incluindo hoje); dias sem nada entram zerados.
export function buildReport(
  tasks: ReportTask[],
  days: number,
  today: string,
): Report {
  const first = addDaysLocal(today, -(days - 1));
  const buckets = new Map<string, { count: number; xp: number }>();
  for (let i = 0; i < days; i++) {
    buckets.set(addDaysLocal(first, i), { count: 0, xp: 0 });
  }

  const byDifficulty: Record<Difficulty, number> = {
    EASY: 0,
    MEDIUM: 0,
    HARD: 0,
    EPIC: 0,
  };
  const items: Report['items'] = [];
  let completed = 0;
  let xp = 0;

  const ordered = [...tasks].sort(
    (a, b) => b.doneAt.getTime() - a.doneAt.getTime(),
  );
  for (const t of ordered) {
    const bucket = buckets.get(dayKey(t.doneAt));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.xp += t.xp;
    completed += 1;
    xp += t.xp;
    if (t.difficulty in byDifficulty) byDifficulty[t.difficulty as Difficulty]++;
    items.push({
      id: t.id,
      title: t.title,
      difficulty: t.difficulty,
      xp: t.xp,
      doneAt: t.doneAt.toISOString(),
    });
  }

  return {
    days,
    completed,
    xp,
    byDay: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
    byDifficulty,
    items,
  };
}
