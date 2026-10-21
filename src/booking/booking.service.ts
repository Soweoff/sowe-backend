import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ZohoService } from '../zoho/zoho.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  MAX_DAYS_AHEAD,
  MAX_PENDING,
  SLOT_MINUTES,
  addDaysLocal,
  approvedTitle,
  buildPendingEvent,
  expandBusy,
  generateSlots,
  isPendingEvent,
  isSlotAvailable,
  toLocalBrt,
  toPendingBooking,
} from './booking.utils';

const CALENDAR = 'personal';
const EVENTS_CACHE_MS = 60 * 1000; // evita consultar o Zoho a cada visita

@Injectable()
export class BookingService {
  private eventsCache: { at: number; events: any[] } | null = null;
  // Pedidos são tratados um de cada vez: duas pessoas não pegam o mesmo horário.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly zoho: ZohoService) {}

  private async loadEvents(fresh = false): Promise<any[]> {
    const cached = this.eventsCache;
    if (!fresh && cached && Date.now() - cached.at < EVENTS_CACHE_MS) {
      return cached.events;
    }
    const events = await this.zoho.getEvents(CALENDAR);
    this.eventsCache = { at: Date.now(), events };
    return events;
  }

  private busyFrom(events: any[], nowLocal: string) {
    const today = nowLocal.slice(0, 10);
    return expandBusy(events, today, addDaysLocal(today, MAX_DAYS_AHEAD + 1));
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getSlots() {
    const nowLocal = toLocalBrt(new Date());
    const events = await this.loadEvents();
    return {
      timezone: 'America/Sao_Paulo',
      slotMinutes: SLOT_MINUTES,
      days: generateSlots(nowLocal, this.busyFrom(events, nowLocal)),
    };
  }

  async request(dto: CreateBookingDto) {
    // Campo-isca preenchido: finge que deu certo e não cria nada.
    if (dto.website?.trim()) return { ok: true };

    return this.serialize(async () => {
      const nowLocal = toLocalBrt(new Date());
      const events = await this.loadEvents(true);

      const pending = events.filter(isPendingEvent).length;
      if (pending >= MAX_PENDING) {
        throw new HttpException(
          'Há muitos pedidos em análise no momento. Tente novamente mais tarde ou chame no WhatsApp.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!isSlotAvailable(dto.start, nowLocal, this.busyFrom(events, nowLocal))) {
        throw new ConflictException(
          'Esse horário não está mais disponível. Escolha outro.',
        );
      }

      await this.zoho.createEvent(CALENDAR, buildPendingEvent(dto, nowLocal));
      this.eventsCache = null;

      return { ok: true };
    });
  }

  // ----- Administração -----

  private async findPending(id: string) {
    const events = await this.loadEvents(true);
    const found = events.find((e) => e.id === id && isPendingEvent(e));
    if (!found) throw new NotFoundException('Pedido não encontrado.');
    return toPendingBooking(await this.withDescription(found));
  }

  // A lista do Zoho não traz a descrição: buscamos só dos pedidos pendentes.
  private async withDescription(e: any) {
    if (/^Contato:/m.test(e.description ?? '')) return e;
    try {
      const description = await this.zoho.getEventDescription(CALENDAR, e.id);
      return { ...e, description };
    } catch {
      return e;
    }
  }

  async listPending() {
    const events = await this.loadEvents(true);
    const pending = await Promise.all(
      events.filter(isPendingEvent).map((e) => this.withDescription(e)),
    );
    return pending
      .map(toPendingBooking)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async approve(id: string) {
    const booking = await this.findPending(id);

    await this.zoho.updateEvent(CALENDAR, id, {
      title: approvedTitle(booking.name),
      start: booking.start,
      end: booking.end,
      description: booking.description,
      status: 'Agendado',
    });
    this.eventsCache = null;

    return { ok: true };
  }

  async reject(id: string) {
    await this.findPending(id); // só apaga eventos que são pedidos pendentes
    await this.zoho.deleteEvent(CALENDAR, id);
    this.eventsCache = null;
    return { ok: true };
  }
}
