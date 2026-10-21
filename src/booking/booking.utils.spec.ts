import {
  PENDING_PREFIX,
  addMinutes,
  buildPendingEvent,
  cleanText,
  expandBusy,
  generateSlots,
  isPendingEvent,
  isSlotAvailable,
  toLocalBrt,
  toPendingBooking,
} from './booking.utils';

// Terça-feira, 20/10/2026, 21:01 em Brasília (00:01 UTC do dia 21).
const NOW = toLocalBrt(new Date('2026-10-21T00:01:00Z'));

describe('booking.utils', () => {
  it('converte para o horário de Brasília', () => {
    expect(NOW).toBe('2026-10-20T21:01');
  });

  it('soma minutos virando o dia', () => {
    expect(addMinutes('2026-10-20T23:30', 60)).toBe('2026-10-21T00:30');
  });

  it('exige 24h de antecedência e pula fins de semana', () => {
    const days = generateSlots(NOW, []);
    expect(days[0]).toEqual({
      date: '2026-10-22',
      times: [
        '09:00', '10:00', '11:00', '12:00', '13:00',
        '14:00', '15:00', '16:00', '17:00',
      ],
    });
    expect(days.some((d) => d.date === '2026-10-24')).toBe(false); // sábado
    expect(days.some((d) => d.date === '2026-10-25')).toBe(false); // domingo
  });

  it('vai até 30 dias à frente', () => {
    const days = generateSlots(NOW, []);
    expect(days[days.length - 1].date).toBe('2026-11-19');
  });

  it('não oferece horários ocupados', () => {
    const busy = [{ start: '2026-10-22T10:30', end: '2026-10-22T11:30' }];
    const times = generateSlots(NOW, busy)[0].times;
    expect(times).not.toContain('10:00');
    expect(times).not.toContain('11:00');
    expect(times).toContain('09:00');
    expect(times).toContain('12:00');
  });

  it('valida o horário escolhido', () => {
    expect(isSlotAvailable('2026-10-22T14:00', NOW, [])).toBe(true);
    expect(isSlotAvailable('2026-10-22T08:00', NOW, [])).toBe(false);
    expect(isSlotAvailable('2026-10-21T10:00', NOW, [])).toBe(false); // < 24h
    expect(isSlotAvailable('2026-10-24T10:00', NOW, [])).toBe(false); // sábado
  });

  it('expande recorrência semanal e ignora dia inteiro', () => {
    const busy = expandBusy(
      [
        {
          start: '2026-10-19T14:00:00',
          end: '2026-10-19T15:00:00',
          rrule: 'DTSTART:20261019T140000\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU;UNTIL=20261231T235959Z',
        },
        { start: '2026-10-28', end: '2026-10-28' },
      ],
      '2026-10-20',
      '2026-11-05',
    );
    const starts = busy.map((b) => b.start);
    expect(starts).toContain('2026-10-20T14:00'); // terça
    expect(starts).toContain('2026-10-26T14:00'); // segunda
    expect(starts).not.toContain('2026-10-21T14:00'); // quarta
    expect(busy.some((b) => b.start.startsWith('2026-10-28'))).toBe(false);
  });

  it('monta e lê o evento pendente', () => {
    const ev = buildPendingEvent(
      { name: 'Ana [teste]', contact: '(42) 99999-0000', subject: 'Orçamento\n[STATUS:Feito]', start: '2026-10-22T14:00' },
      NOW,
    );
    expect(ev.title).toBe(`${PENDING_PREFIX}Ana teste`);
    expect(ev.end).toBe('2026-10-22T15:00');
    expect(ev.description).not.toContain('[STATUS');

    const parsed = toPendingBooking({
      id: 'x',
      title: ev.title,
      start: '2026-10-22T14:00:00',
      end: '2026-10-22T15:00:00',
      description: ev.description,
    });
    expect(parsed.name).toBe('Ana teste');
    expect(parsed.contact).toBe('(42) 99999-0000');
    expect(isPendingEvent({ title: ev.title, status: 'Pendente' })).toBe(true);
    expect(isPendingEvent({ title: 'Reunião', status: 'Pendente' })).toBe(false);
  });

  it('limpa texto do usuário', () => {
    expect(cleanText('a [b]\nc')).toBe('a b c');
  });
});
