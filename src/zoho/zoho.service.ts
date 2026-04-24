import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ZohoService {
  constructor(private configService: ConfigService) {}

  // 1. Método para renovar o Access Token
  async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('ZOHO_REFRESH_TOKEN');

    // 👇 ESPIÃO ADICIONADO AQUI 👇
    console.log('--- TESTE DE LEITURA DO .ENV ---');
    console.log('ID lido:', clientId);
    console.log('Secret lido:', clientSecret);
    console.log('--------------------------------');

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

  // Função auxiliar para arrumar a data maluca do Zoho para o FullCalendar
  private formatZohoDate(zDate: string): string | null {
    if (!zDate) return null;

    // Se for dia todo (ex: 20260424) -> 2026-04-24
    if (zDate.length === 8) {
      return `${zDate.substring(0, 4)}-${zDate.substring(4, 6)}-${zDate.substring(6, 8)}`;
    }

    // Se tiver horário (ex: 20260424T103000-0300) -> 2026-04-24T10:30:00
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

  // 2. Método para buscar os eventos
  async getEvents() {
    const token = await this.getAccessToken();

    try {
      // A. Primeiro, buscamos a lista de calendários para pegar o UID real
      const calendarsUrl = 'https://calendar.zoho.com/api/v1/calendars';
      const calendarsRes = await axios.get(calendarsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const calendars = calendarsRes.data.calendars;
      if (!calendars || calendars.length === 0) return [];

      // Pegamos o UID do seu primeiro calendário (o principal)
      const realCalendarId = calendars[0].uid;

      // B. Agora buscamos os eventos usando o UID correto
      const eventsUrl = `https://calendar.zoho.com/api/v1/calendars/${realCalendarId}/events`;
      const eventsRes = await axios.get(eventsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const events = eventsRes.data.events;

      // C. Formatamos para o React
      if (events && events.length > 0) {
        return events.map((event: any) => {
          const start = event.dateandtime?.start || '';
          const end = event.dateandtime?.end || '';

          return {
            id: event.uid,
            title: event.title,
            start: this.formatZohoDate(start),
            end: this.formatZohoDate(end),
            backgroundColor: '#6c63ff',
            description: event.description || 'Sem descrição adicional',
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
}
