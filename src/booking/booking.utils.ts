// Regras do agendamento público. Tudo aqui é função pura (sem Nest), para ser
// fácil de testar. Os horários são sempre "hora de Brasília" em texto:
// "2026-10-21T14:00" (o Brasil não usa mais horário de verão, o fuso é fixo).

export const SLOT_MINUTES = 60; // reunião de 1 hora
export const FIRST_HOUR = 9; // primeiro horário: 9h
export const LAST_END_HOUR = 18; // a última reunião termina às 18h
export const MIN_NOTICE_HOURS = 24; // antecedência mínima
export const MAX_DAYS_AHEAD = 30; // até 30 dias à frente
export const MAX_PENDING = 30; // limite de pedidos aguardando aprovação

export const PENDING_PREFIX = '⏳ PENDENTE · ';
export const PENDING_STATUS = 'Pendente';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface Interval {
  start: string; // "YYYY-MM-DDTHH:mm"
  end: string;
}

export interface DaySlots {
  date: string; // "YYYY-MM-DD"
  times: string[]; // ["09:00", "10:00", ...]
}

const pad = (n: number) => String(n).padStart(2, '0');

// Data/hora atual em Brasília: "YYYY-MM-DDTHH:mm".
export function toLocalBrt(now: Date): string {
  return new Date(now.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 16);
}

export function addMinutes(local: string, minutes: number): string {
  const d = new Date(`${local.slice(0, 16)}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

export function addDaysLocal(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = domingo
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

// Horários livres: segunda a sexta, 9h–18h, de hora em hora, com 24h de
// antecedência e até 30 dias à frente.
export function generateSlots(nowLocal: string, busy: Interval[]): DaySlots[] {
  const earliest = addMinutes(nowLocal, MIN_NOTICE_HOURS * 60);
  const today = nowLocal.slice(0, 10);
  const days: DaySlots[] = [];

  for (let i = 0; i <= MAX_DAYS_AHEAD; i++) {
    const date = addDaysLocal(today, i);
    const wd = weekday(date);
    if (wd === 0 || wd === 6) continue;

    const times: string[] = [];
    for (let h = FIRST_HOUR; h + SLOT_MINUTES / 60 <= LAST_END_HOUR; h++) {
      const start = `${date}T${pad(h)}:00`;
      const end = addMinutes(start, SLOT_MINUTES);
      if (start < earliest) continue;
      if (busy.some((b) => overlaps({ start, end }, b))) continue;
      times.push(`${pad(h)}:00`);
    }

    if (times.length) days.push({ date, times });
  }

  return days;
}

export function isSlotAvailable(
  start: string,
  nowLocal: string,
  busy: Interval[],
): boolean {
  const date = start.slice(0, 10);
  const time = start.slice(11, 16);
  return generateSlots(nowLocal, busy).some(
    (d) => d.date === date && d.times.includes(time),
  );
}

// ---------------------------------------------------------------------------
// Eventos do Zoho -> intervalos ocupados
// ---------------------------------------------------------------------------

export interface ZohoLikeEvent {
  start?: string | null; // "YYYY-MM-DDTHH:mm:ss" ou "YYYY-MM-DD" (dia inteiro)
  end?: string | null;
  rrule?: string | null; // "DTSTART:...\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU;UNTIL=..."
}

const DAY_CODES: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseRule(rrule: string) {
  const line = /RRULE:([^\n\r]+)/.exec(rrule)?.[1];
  if (!line) return null;
  const parts: Record<string, string> = {};
  for (const piece of line.split(';')) {
    const [k, v] = piece.split('=');
    if (k && v) parts[k] = v;
  }
  const until = parts.UNTIL
    ? `${parts.UNTIL.slice(0, 4)}-${parts.UNTIL.slice(4, 6)}-${parts.UNTIL.slice(6, 8)}`
    : null;
  return {
    freq: parts.FREQ,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    byDay: parts.BYDAY
      ? parts.BYDAY.split(',')
          .map((c) => DAY_CODES[c.replace(/[^A-Z]/g, '')])
          .filter((n) => n !== undefined)
      : null,
    until,
  };
}

// Dias inteiros não bloqueiam horários (costumam ser lembretes/prazos).
// Recorrências semanais e diárias são expandidas; outras são ignoradas (e, de
// qualquer forma, toda reunião passa pela sua aprovação).
export function expandBusy(
  events: ZohoLikeEvent[],
  fromDate: string,
  toDate: string,
): Interval[] {
  const out: Interval[] = [];

  for (const e of events) {
    if (!e.start || !e.end || e.start.length < 16 || e.end.length < 16) continue;

    const start = e.start.slice(0, 16).replace(' ', 'T');
    const end = e.end.slice(0, 16).replace(' ', 'T');
    if (end <= start) continue;

    const rule = e.rrule ? parseRule(e.rrule) : null;

    if (!rule) {
      if (end > `${fromDate}T00:00` && start < `${addDaysLocal(toDate, 1)}T00:00`) {
        out.push({ start, end });
      }
      continue;
    }

    if (rule.freq !== 'WEEKLY' && rule.freq !== 'DAILY') continue;

    const startDate = start.slice(0, 10);
    const startTime = start.slice(11, 16);
    const durationMin = Math.round(
      (Date.parse(`${end}:00Z`) - Date.parse(`${start}:00Z`)) / 60_000,
    );

    for (
      let d = fromDate > startDate ? fromDate : startDate;
      d <= toDate;
      d = addDaysLocal(d, 1)
    ) {
      if (rule.until && d > rule.until) break;
      const offset = daysBetween(startDate, d);
      let match: boolean;

      if (rule.freq === 'DAILY') {
        match = offset % rule.interval === 0;
      } else {
        const wds = rule.byDay?.length ? rule.byDay : [weekday(startDate)];
        match =
          wds.includes(weekday(d)) &&
          Math.floor(offset / 7) % rule.interval === 0;
      }

      if (match) {
        const s = `${d}T${startTime}`;
        out.push({ start: s, end: addMinutes(s, durationMin) });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Pedido de reunião <-> evento pendente no Zoho
// ---------------------------------------------------------------------------

// Remove colchetes (usados nas marcações internas) e quebras de linha.
export function cleanText(value: string | undefined): string {
  return (value ?? '')
    .replace(/[[\]\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface BookingInput {
  name: string;
  contact: string;
  subject?: string;
  start: string; // "YYYY-MM-DDTHH:00"
}

export function buildPendingEvent(input: BookingInput, nowLocal: string) {
  const name = cleanText(input.name);
  const contact = cleanText(input.contact);
  const subject = cleanText(input.subject) || '-';
  const start = input.start.slice(0, 16);

  return {
    title: `${PENDING_PREFIX}${name}`,
    start,
    end: addMinutes(start, SLOT_MINUTES),
    description:
      `Contato: ${contact}\nAssunto: ${subject}\n` +
      `Pedido feito pelo site em ${nowLocal.replace('T', ' ')}`,
    status: PENDING_STATUS,
    notifyPersonal: true,
    reminderEnabled: false,
  };
}

export interface PendingBooking {
  id: string;
  name: string;
  contact: string;
  subject: string;
  start: string;
  end: string;
  description: string;
}

// Reconhece pelo título ("⏳ PENDENTE · Nome"), que a lista do Zoho sempre
// devolve. Ignora emoji/símbolos no começo, caso o Zoho os altere.
const PENDING_TITLE = /^[^\p{L}\p{N}]*PENDENTE\s*·\s*/u;

export function isPendingEvent(e: { title?: string; status?: string }): boolean {
  return PENDING_TITLE.test(e.title ?? '');
}

export function toPendingBooking(e: {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
}): PendingBooking {
  const description = e.description ?? '';
  return {
    id: e.id,
    name: e.title.replace(PENDING_TITLE, '').trim(),
    contact: /^Contato: (.*)$/m.exec(description)?.[1]?.trim() ?? '',
    subject: /^Assunto: (.*)$/m.exec(description)?.[1]?.trim() ?? '',
    start: e.start,
    end: e.end,
    description,
  };
}

export function approvedTitle(name: string): string {
  return `Reunião · ${name}`;
}
