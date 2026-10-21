import {
  buildReport,
  computeStreaks,
  dayKey,
  levelFromXp,
} from './tasks.utils';

describe('tasks.utils', () => {
  it('calcula o nível e o progresso', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xp: 0, into: 0, needed: 50 });
    expect(levelFromXp(49).level).toBe(1);
    expect(levelFromXp(50)).toEqual({ level: 2, xp: 50, into: 0, needed: 150 });
    expect(levelFromXp(200).level).toBe(3);
    expect(levelFromXp(-5).xp).toBe(0);
  });

  it('usa o dia de Brasília', () => {
    // 01:00 UTC ainda é o dia anterior em Brasília.
    expect(dayKey(new Date('2026-10-21T01:00:00Z'))).toBe('2026-10-20');
    expect(dayKey(new Date('2026-10-21T12:00:00Z'))).toBe('2026-10-21');
  });

  it('conta a sequência atual e a melhor', () => {
    const days = ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21'];
    expect(computeStreaks(days, '2026-10-21')).toEqual({ current: 3, best: 3 });
  });

  it('mantém a sequência se hoje ainda não teve conclusões', () => {
    expect(computeStreaks(['2026-10-19', '2026-10-20'], '2026-10-21').current).toBe(2);
  });

  it('zera a sequência após um dia vazio', () => {
    expect(computeStreaks(['2026-10-18'], '2026-10-21')).toEqual({ current: 0, best: 1 });
    expect(computeStreaks([], '2026-10-21')).toEqual({ current: 0, best: 0 });
  });

  it('monta o relatório com dias zerados e ignora o que está fora do período', () => {
    const r = buildReport(
      [
        { id: 1, title: 'A', difficulty: 'EASY', xp: 10, doneAt: new Date('2026-10-21T15:00:00Z') },
        { id: 2, title: 'B', difficulty: 'EPIC', xp: 80, doneAt: new Date('2026-10-21T18:00:00Z') },
        { id: 3, title: 'C', difficulty: 'HARD', xp: 40, doneAt: new Date('2026-10-19T15:00:00Z') },
        { id: 4, title: 'Velha', difficulty: 'EASY', xp: 10, doneAt: new Date('2026-09-01T15:00:00Z') },
      ],
      7,
      '2026-10-21',
    );
    expect(r.byDay).toHaveLength(7);
    expect(r.byDay[0].date).toBe('2026-10-15');
    expect(r.byDay[6]).toEqual({ date: '2026-10-21', count: 2, xp: 90 });
    expect(r.byDay[5]).toEqual({ date: '2026-10-20', count: 0, xp: 0 });
    expect(r.completed).toBe(3);
    expect(r.xp).toBe(130);
    expect(r.byDifficulty).toEqual({ EASY: 1, MEDIUM: 0, HARD: 1, EPIC: 1 });
    expect(r.items.map((i) => i.id)).toEqual([2, 1, 3]);
  });
});
