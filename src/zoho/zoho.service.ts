import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import {
  AccessTokenCache,
  type FetchedToken,
  isTransientError,
  parseExpiresInSec,
  toZohoFormat,
  withRetry,
} from './zoho.utils';

type CalendarKey = 'personal' | 'tnk_store';
type ReminderAction = 'email' | 'popup' | 'notification';

interface ZohoEventPayload {
  title: string;
  start: string;
  end: string;
  description?: string;
  status?: string;

  isRecurring?: boolean;
  repeatUntil?: string;
  daysOfWeek?: string[];

  reminderEnabled?: boolean;
  reminderAction?: ReminderAction;
  reminderMinutes?: number;

  notifyPersonal?: boolean;
  attendeeEmail?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;
const RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

@Injectable()
export class ZohoService {
  // O access token do Zoho vale ~1h. Guardamos em memória em vez de pedir um
  // novo a cada requisição (o Zoho limita quantos tokens cada refresh token
  // pode gerar em poucos minutos, o que causava falhas intermitentes).
  private readonly tokenCache = new AccessTokenCache();

  constructor(private configService: ConfigService) {}

  // Contas de outras regiões usam outros domínios (zoho.eu, zoho.in...).
  private get accountsUrl(): string {
    return (
      this.configService.get<string>('ZOHO_ACCOUNTS_URL') ||
      'https://accounts.zoho.com'
    );
  }

  private get calendarApiUrl(): string {
    return (
      this.configService.get<string>('ZOHO_CALENDAR_API_URL') ||
      'https://calendar.zoho.com/api/v1'
    );
  }

  private async requestNewToken(): Promise<FetchedToken> {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('ZOHO_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new HttpException(
        'Credenciais Zoho não configuradas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Credenciais no corpo da requisição (e não na URL), para não aparecerem
    // em logs de acesso.
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    try {
      const response = await withRetry(
        () =>
          axios.post(`${this.accountsUrl}/oauth/v2/token`, body, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        {
          retries: RETRIES,
          baseDelayMs: RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientError,
        },
      );

      if (response.data?.error || !response.data?.access_token) {
        throw new Error(response.data?.error || 'Resposta sem access_token');
      }

      return {
        token: response.data.access_token as string,
        expiresInSec: parseExpiresInSec(response.data),
      };
    } catch (error: any) {
      console.error('ZOHO AUTH ERROR:', error.response?.data || error.message);

      // Não usamos 401 aqui de propósito: o frontend trata 401 como
      // "sessão expirada" e deslogaria o usuário por um problema do Zoho.
      throw new HttpException(
        'Falha na autenticação com o Zoho',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getAccessToken(): Promise<string> {
    return this.tokenCache.get(() => this.requestNewToken());
  }

  private async send<T = any>(
    config: AxiosRequestConfig,
    forceNewToken: boolean,
  ): Promise<AxiosResponse<T>> {
    if (forceNewToken) this.tokenCache.invalidate();

    const token = await this.getAccessToken();

    return axios.request<T>({
      timeout: REQUEST_TIMEOUT_MS,
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });
  }

  /**
   * Faz a chamada à API do Zoho com:
   * - token em cache;
   * - se o Zoho responder 401 (token revogado/expirado), gera um token novo
   *   e repete a chamada uma vez;
   * - novas tentativas em falhas transitórias (rede, 429, 5xx), apenas para
   *   operações idempotentes. Criar evento NÃO é repetido, para não duplicar.
   */
  private async zohoRequest<T = any>(
    config: AxiosRequestConfig,
    idempotent: boolean,
  ): Promise<AxiosResponse<T>> {
    const run = async () => {
      try {
        return await this.send<T>(config, false);
      } catch (error: any) {
        if (error?.response?.status === 401) {
          return this.send<T>(config, true);
        }

        throw error;
      }
    };

    if (!idempotent) return run();

    return withRetry(run, {
      retries: RETRIES,
      baseDelayMs: RETRY_BASE_DELAY_MS,
      shouldRetry: isTransientError,
    });
  }

  // Traduz o erro do Zoho para uma resposta clara. O motivo real fica nos
  // logs do servidor (procure por "ZOHO ERROR").
  private toHttpException(error: any, fallbackMessage: string): HttpException {
    if (error instanceof HttpException) return error;

    if (error instanceof RangeError) {
      return new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    const status: number | undefined = error?.response?.status;

    console.error(
      `ZOHO ERROR [${fallbackMessage}] status=${status ?? error?.code ?? 'n/a'}`,
      error?.response?.data || error?.message,
    );

    if (status === 429) {
      return new HttpException(
        'O Zoho limitou as requisições. Tente novamente em instantes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (status === 404) {
      return new HttpException(
        'Evento ou calendário não encontrado no Zoho',
        HttpStatus.NOT_FOUND,
      );
    }

    if (status === 400) {
      return new HttpException(
        'O Zoho rejeitou os dados do evento',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
      return new HttpException(
        'O Zoho demorou demais para responder. Tente novamente.',
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }

    return new HttpException(fallbackMessage, HttpStatus.BAD_GATEWAY);
  }

  private getCalendarId(calendar: CalendarKey = 'tnk_store'): string {
    let calendarId: string | undefined;

    if (calendar === 'personal') {
      calendarId = this.configService.get<string>('ZOHO_CALENDAR_ID');
    }

    if (calendar === 'tnk_store') {
      calendarId = this.configService.get<string>('ZOHO_TNK_STORE_CALENDAR_ID');
    }

    if (!calendarId) {
      throw new HttpException(
        `Calendário "${calendar}" não configurado no Render`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return calendarId;
  }

  private normalizeCalendar(calendar?: string): CalendarKey {
    if (calendar === 'personal') return 'personal';
    if (calendar === 'tnk_store') return 'tnk_store';
    return 'tnk_store';
  }

  private formatZohoDate(zDate: string): string | null {
    if (!zDate) return null;

    if (zDate.length === 8) {
      return `${zDate.substring(0, 4)}-${zDate.substring(4, 6)}-${zDate.substring(6, 8)}`;
    }

    if (zDate.length >= 15 && zDate.includes('T')) {
      const y = zDate.substring(0, 4);
      const m = zDate.substring(4, 6);
      const d = zDate.substring(6, 8);
      const h = zDate.substring(9, 11);
      const min = zDate.substring(11, 13);
      const sec = zDate.substring(13, 15);

      return `${y}-${m}-${d}T${h}:${min}:${sec}`;
    }

    return zDate;
  }

  private getEventDuration(
    start?: string | null,
    end?: string | null,
  ): string | undefined {
    if (!start || !end) return undefined;

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return undefined;
    }

    const diffMs = endDate.getTime() - startDate.getTime();

    if (diffMs <= 0) return undefined;

    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private buildFullCalendarRRule(
    event: any,
    start?: string | null,
  ): string | undefined {
    if (!event.rrule || !start) return undefined;

    const startDate = new Date(start);

    if (Number.isNaN(startDate.getTime())) return event.rrule;

    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, '0');
    const d = String(startDate.getDate()).padStart(2, '0');
    const h = String(startDate.getHours()).padStart(2, '0');
    const min = String(startDate.getMinutes()).padStart(2, '0');
    const s = String(startDate.getSeconds()).padStart(2, '0');

    return `DTSTART:${y}${m}${d}T${h}${min}${s}\nRRULE:${event.rrule}`;
  }

  private buildReminders(eventData: ZohoEventPayload) {
    if (!eventData.reminderEnabled) return undefined;

    const action: ReminderAction = eventData.reminderAction || 'notification';
    const minutes = Number(eventData.reminderMinutes ?? 5);

    if (!Number.isFinite(minutes) || minutes < 0) {
      throw new HttpException(
        'O tempo do lembrete precisa ser um número válido em minutos.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return [
      {
        action,
        minutes,
      },
    ];
  }

  private buildPersonalAttendee(eventData: ZohoEventPayload) {
    if (!eventData.notifyPersonal) return undefined;

    const email =
      eventData.attendeeEmail?.trim() ||
      this.configService.get<string>('ZOHO_PERSONAL_NOTIFICATION_EMAIL');

    if (!email) return undefined;

    return [
      {
        email,
        permission: 1,
        attendance: 1,
      },
    ];
  }

  private applyNotificationsToEventObj(
    eventObj: any,
    eventData: ZohoEventPayload,
  ) {
    const reminders = this.buildReminders(eventData);
    const attendees = this.buildPersonalAttendee(eventData);

    if (reminders) {
      eventObj.reminders = reminders;
      eventObj.calendar_alarm = true;
    } else {
      eventObj.calendar_alarm = false;
    }

    if (attendees) {
      eventObj.attendees = attendees;
      eventObj.notify_attendee = 2;
    } else {
      eventObj.notify_attendee = 0;
    }
  }

  // Monta o objeto de evento no formato do Zoho (usado ao criar e ao editar).
  private buildEventObj(eventData: ZohoEventPayload) {
    const status = eventData.status || 'Agendado';
    const hiddenStatusTag = `[STATUS:${status}] \n\n`;

    const start = toZohoFormat(eventData.start);
    const end = toZohoFormat(eventData.end);

    // Mesmo formato e mesmo fuso, então a comparação de texto é segura.
    if (end < start) {
      throw new HttpException(
        'O término não pode ser antes do início.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const eventObj: any = {
      title: eventData.title,
      description: hiddenStatusTag + (eventData.description || ''),
      dateandtime: {
        timezone: 'America/Sao_Paulo',
        start,
        end,
      },
    };

    this.applyNotificationsToEventObj(eventObj, eventData);

    if (
      eventData.isRecurring &&
      eventData.repeatUntil &&
      eventData.daysOfWeek &&
      eventData.daysOfWeek.length > 0
    ) {
      const untilDate = eventData.repeatUntil.replace(/-/g, '');
      const days = eventData.daysOfWeek.join(',');

      eventObj.rrule = `FREQ=WEEKLY;BYDAY=${days};UNTIL=${untilDate}T235959Z`;
    }

    return eventObj;
  }

  private eventsUrl(calendarId: string) {
    return `${this.calendarApiUrl}/calendars/${calendarId}/events`;
  }

  private eventUrl(calendarId: string, eventId: string) {
    return `${this.eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`;
  }

  // O Zoho exige o ETag atual do evento para editar ou excluir.
  private async getEtag(eventUrl: string): Promise<string> {
    const eventInfo = await this.zohoRequest(
      { method: 'GET', url: eventUrl },
      true,
    );

    const etag = eventInfo.data?.events?.[0]?.etag;

    if (!etag) {
      throw new HttpException(
        'Evento não encontrado no Zoho',
        HttpStatus.NOT_FOUND,
      );
    }

    return String(etag);
  }

  // Um evento só, incluindo a descrição (a lista do Zoho não a devolve).
  async getEventDescription(
    calendar: string | undefined,
    eventId: string,
  ): Promise<string> {
    const calendarId = this.getCalendarId(this.normalizeCalendar(calendar));

    try {
      const res = await this.zohoRequest(
        {
          method: 'GET',
          url: this.eventUrl(calendarId, eventId),
          headers: { Accept: 'application/json+large' },
        },
        true,
      );
      const raw: string = res.data?.events?.[0]?.description ?? '';
      return raw.replace(/\[STATUS:.*?\]/, '').trim();
    } catch (error: any) {
      throw this.toHttpException(error, 'Erro ao buscar o evento no Zoho');
    }
  }

  async getEvents(calendar?: string) {
    const calendarKey = this.normalizeCalendar(calendar);
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventsRes = await this.zohoRequest(
        { method: 'GET', url: this.eventsUrl(calendarId) },
        true,
      );

      const events = eventsRes.data?.events;

      if (!events || events.length === 0) return [];

      return events.map((event: any) => {
        let rawDesc = event.description || '';
        let status = 'Agendado';
        let color = '#6c63ff';

        const statusMatch = rawDesc.match(/\[STATUS:(.*?)\]/);

        if (statusMatch) {
          status = statusMatch[1].trim();
          rawDesc = rawDesc.replace(statusMatch[0], '').trim();

          if (status === 'Feito') color = '#22c55e';
          else if (status === 'Em andamento') color = '#f59e0b';
          else if (status === 'Não iniciado') color = '#64748b';
        }

        const start = this.formatZohoDate(event.dateandtime?.start);
        const end = this.formatZohoDate(event.dateandtime?.end);
        const rrule = this.buildFullCalendarRRule(event, start);
        const duration = this.getEventDuration(start, end);

        return {
          id: event.uid,
          title: event.title,
          start,
          end,
          rrule,
          duration,
          backgroundColor: color,
          borderColor: color,
          description: rawDesc || 'Sem descrição adicional',
          status,
          calendar: calendarKey,
          reminders: event.reminders || [],
          calendarAlarm: event.calendar_alarm || false,
          attendees: event.attendees || [],
        };
      });
    } catch (error: any) {
      throw this.toHttpException(error, 'Erro ao buscar eventos do Zoho');
    }
  }

  async createEvent(calendar: string | undefined, eventData: ZohoEventPayload) {
    const calendarKey = this.normalizeCalendar(calendar);
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventObj = this.buildEventObj(eventData);

      const params = new URLSearchParams();
      params.append('eventdata', JSON.stringify(eventObj));

      // idempotent = false: não repetimos a criação para não duplicar eventos.
      const response = await this.zohoRequest(
        {
          method: 'POST',
          url: this.eventsUrl(calendarId),
          data: params,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
        false,
      );

      return {
        message: 'Evento criado com sucesso no Zoho',
        calendar: calendarKey,
        data: response.data,
      };
    } catch (error: any) {
      throw this.toHttpException(error, 'Erro ao criar evento no Zoho');
    }
  }

  async updateEvent(
    calendar: string | undefined,
    eventId: string,
    eventData: ZohoEventPayload,
  ) {
    const calendarKey = this.normalizeCalendar(calendar);
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventUrl = this.eventUrl(calendarId, eventId);
      const eventObj = this.buildEventObj(eventData);
      const etag = await this.getEtag(eventUrl);

      const params = new URLSearchParams();
      params.append('eventdata', JSON.stringify(eventObj));

      await this.zohoRequest(
        {
          method: 'PUT',
          url: eventUrl,
          data: params,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ETag: etag,
          },
        },
        true,
      );

      return {
        message: 'Evento atualizado com sucesso',
        calendar: calendarKey,
      };
    } catch (error: any) {
      throw this.toHttpException(error, 'Erro ao atualizar evento');
    }
  }

  async deleteEvent(calendar: string | undefined, eventId: string) {
    const calendarKey = this.normalizeCalendar(calendar);
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventUrl = this.eventUrl(calendarId, eventId);
      const etag = await this.getEtag(eventUrl);

      await this.zohoRequest(
        { method: 'DELETE', url: eventUrl, headers: { ETag: etag } },
        true,
      );

      return {
        message: 'Evento deletado com sucesso',
        calendar: calendarKey,
      };
    } catch (error: any) {
      throw this.toHttpException(error, 'Erro ao deletar evento');
    }
  }
}
