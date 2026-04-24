import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ZohoService {
  constructor(private configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('ZOHO_REFRESH_TOKEN');

    const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;

    try {
      const response = await axios.post(url);
      return response.data.access_token;
    } catch (error: any) {
      console.error('ZOHO AUTH ERROR:', error.response?.data || error.message);
      throw new HttpException(
        'Falha na autenticação com o Zoho',
        HttpStatus.UNAUTHORIZED,
      );
    }
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

  // --- BUSCAR EVENTOS E LER A COR ---
  async getEvents() {
    const token = await this.getAccessToken();

    try {
      const calendarsRes = await axios.get(
        'https://calendar.zoho.com/api/v1/calendars',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const calendars = calendarsRes.data.calendars;
      if (!calendars || calendars.length === 0) return [];
      const realCalendarId = calendars[0].uid;

      const eventsRes = await axios.get(
        `https://calendar.zoho.com/api/v1/calendars/${realCalendarId}/events`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const events = eventsRes.data.events;

      if (events && events.length > 0) {
        return events.map((event: any) => {
          let rawDesc = event.description || '';
          let status = 'Agendado'; // Padrão
          let color = '#6c63ff'; // Roxo padrão

          // Verifica se tem a nossa Tag secreta e extrai
          const statusMatch = rawDesc.match(/\[STATUS:(.*?)\]/);
          if (statusMatch) {
            status = statusMatch[1].trim();
            rawDesc = rawDesc.replace(statusMatch[0], '').trim();

            // Define a cor baseada no status
            if (status === 'Feito') color = '#22c55e';
            else if (status === 'Em andamento') color = '#f59e0b';
            else if (status === 'Não iniciado') color = '#64748b';
          }

          return {
            id: event.uid,
            title: event.title,
            start: this.formatZohoDate(event.dateandtime?.start),
            end: this.formatZohoDate(event.dateandtime?.end),
            backgroundColor: color,
            description: rawDesc || 'Sem descrição adicional',
            status: status,
          };
        });
      }
      return [];
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

  private toZohoFormat(dateString: string): string {
    const date = new Date(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = '00';
    return `${y}${m}${d}T${h}${min}${sec}-0300`;
  }

  // --- CRIAR EVENTO (COM RECORRÊNCIA) ---
  async createEvent(eventData: {
    title: string;
    start: string;
    end: string;
    description?: string;
    status: string;
    isRecurring?: boolean;
    repeatUntil?: string;
    daysOfWeek?: string[];
  }) {
    const token = await this.getAccessToken();

    try {
      const calendarsRes = await axios.get(
        'https://calendar.zoho.com/api/v1/calendars',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const realCalendarId = calendarsRes.data.calendars[0].uid;

      const hiddenStatusTag = `[STATUS:${eventData.status}] \n\n`;
      const finalDescription = hiddenStatusTag + (eventData.description || '');

      const payload: any = {
        title: eventData.title,
        description: finalDescription,
        dateandtime: {
          start: this.toZohoFormat(eventData.start),
          end: this.toZohoFormat(eventData.end),
        },
      };

      // --- LÓGICA DE RECORRÊNCIA (RRULE) ---
      if (
        eventData.isRecurring &&
        eventData.repeatUntil &&
        eventData.daysOfWeek &&
        eventData.daysOfWeek.length > 0
      ) {
        // Converte data (2026-06-30 -> 20260630)
        const untilDate = eventData.repeatUntil.replace(/-/g, '');
        const days = eventData.daysOfWeek.join(',');

        // Formato oficial de repetição
        payload.rrule = `FREQ=WEEKLY;BYDAY=${days};UNTIL=${untilDate}T235959Z`;
      }

      const createUrl = `https://calendar.zoho.com/api/v1/calendars/${realCalendarId}/events`;

      const response = await axios.post(createUrl, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return {
        message: 'Evento criado com sucesso no Zoho!',
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
}
