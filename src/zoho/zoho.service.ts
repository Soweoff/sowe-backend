import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type CalendarKey = 'personal' | 'tnk_store';

@Injectable()
export class ZohoService {
  constructor(private configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('ZOHO_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new HttpException(
        'Credenciais Zoho não configuradas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const url =
      `https://accounts.zoho.com/oauth/v2/token` +
      `?refresh_token=${refreshToken}` +
      `&client_id=${clientId}` +
      `&client_secret=${clientSecret}` +
      `&grant_type=refresh_token`;

    try {
      const response = await axios.post(url);

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data.access_token;
    } catch (error: any) {
      console.error('ZOHO AUTH ERROR:', error.response?.data || error.message);

      throw new HttpException(
        'Falha na autenticação com o Zoho',
        HttpStatus.UNAUTHORIZED,
      );
    }
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

  private toZohoFormat(dateString: string): string {
    const date = new Date(dateString);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${y}${m}${d}T${h}${min}00-0300`;
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

  async getEvents(calendar?: string) {
    const calendarKey = this.normalizeCalendar(calendar);
    const token = await this.getAccessToken();
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventsRes = await axios.get(
        `https://calendar.zoho.com/api/v1/calendars/${calendarId}/events`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const events = eventsRes.data.events;

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
        };
      });
    } catch (error: any) {
      console.error(
        'ZOHO EVENTS ERROR:',
        error.response?.data || error.message,
      );

      throw new HttpException(
        'Erro ao buscar eventos do Zoho',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createEvent(
    calendar: string | undefined,
    eventData: {
      title: string;
      start: string;
      end: string;
      description?: string;
      status?: string;
      isRecurring?: boolean;
      repeatUntil?: string;
      daysOfWeek?: string[];
    },
  ) {
    const calendarKey = this.normalizeCalendar(calendar);
    const token = await this.getAccessToken();
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const status = eventData.status || 'Agendado';
      const hiddenStatusTag = `[STATUS:${status}] \n\n`;

      const eventObj: any = {
        title: eventData.title,
        description: hiddenStatusTag + (eventData.description || ''),
        dateandtime: {
          timezone: 'America/Sao_Paulo',
          start: this.toZohoFormat(eventData.start),
          end: this.toZohoFormat(eventData.end),
        },
      };

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

      const params = new URLSearchParams();
      params.append('eventdata', JSON.stringify(eventObj));

      const response = await axios.post(
        `https://calendar.zoho.com/api/v1/calendars/${calendarId}/events`,
        params,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return {
        message: 'Evento criado com sucesso no Zoho',
        calendar: calendarKey,
        data: response.data,
      };
    } catch (error: any) {
      console.error(
        'ZOHO CREATE ERROR:',
        error.response?.data || error.message,
      );

      throw new HttpException(
        'Erro ao criar evento no Zoho',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateEvent(
    calendar: string | undefined,
    eventId: string,
    eventData: {
      title: string;
      start: string;
      end: string;
      description?: string;
      status?: string;
    },
  ) {
    const calendarKey = this.normalizeCalendar(calendar);
    const token = await this.getAccessToken();
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventUrl = `https://calendar.zoho.com/api/v1/calendars/${calendarId}/events/${eventId}`;

      const eventInfo = await axios.get(eventUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const etag = eventInfo.data.events?.[0]?.etag;

      if (!etag) {
        throw new Error('ETag do evento não encontrado');
      }

      const status = eventData.status || 'Agendado';
      const hiddenStatusTag = `[STATUS:${status}] \n\n`;

      const eventObj = {
        title: eventData.title,
        description: hiddenStatusTag + (eventData.description || ''),
        dateandtime: {
          timezone: 'America/Sao_Paulo',
          start: this.toZohoFormat(eventData.start),
          end: this.toZohoFormat(eventData.end),
        },
      };

      const params = new URLSearchParams();
      params.append('eventdata', JSON.stringify(eventObj));

      await axios.put(eventUrl, params, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          ETag: String(etag),
        },
      });

      return {
        message: 'Evento atualizado com sucesso',
        calendar: calendarKey,
      };
    } catch (error: any) {
      console.error(
        'ZOHO UPDATE ERROR:',
        error.response?.data || error.message,
      );

      throw new HttpException(
        'Erro ao atualizar evento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteEvent(calendar: string | undefined, eventId: string) {
    const calendarKey = this.normalizeCalendar(calendar);
    const token = await this.getAccessToken();
    const calendarId = this.getCalendarId(calendarKey);

    try {
      const eventUrl = `https://calendar.zoho.com/api/v1/calendars/${calendarId}/events/${eventId}`;

      const eventInfo = await axios.get(eventUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const etag = eventInfo.data.events?.[0]?.etag;

      if (!etag) {
        throw new Error('ETag do evento não encontrado');
      }

      await axios.delete(eventUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          ETag: String(etag),
        },
      });

      return {
        message: 'Evento deletado com sucesso',
        calendar: calendarKey,
      };
    } catch (error: any) {
      console.error(
        'ZOHO DELETE ERROR:',
        error.response?.data || error.message,
      );

      throw new HttpException(
        'Erro ao deletar evento',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
