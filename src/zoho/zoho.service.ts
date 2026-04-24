import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZohoService {
  constructor(private configService: ConfigService) {}

  // 1. Método para renovar o Access Token
  async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('ZOHO_REFRESH_TOKEN');

    const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;

    try {
      const response = await fetch(url, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao obter token do Zoho');
      }
      return data.access_token;
    } catch (error) {
      throw new HttpException(
        'Falha na autenticação com o Zoho',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // 2. Método para buscar os eventos do Calendário
  async getEvents() {
    const token = await this.getAccessToken();
    const calendarId =
      this.configService.get<string>('ZOHO_CALENDAR_ID') || 'primary';

    // A API do calendário exige este endpoint
    const url = `https://calendar.zoho.com/api/v1/calendars/${calendarId}/events`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      // Formatamos o retorno para o padrão que o seu React (FullCalendar) já entende!
      if (data && data.events) {
        return data.events.map((event: any) => ({
          id: event.uid,
          title: event.title,
          start: event.dateandtime.start,
          end: event.dateandtime.end,
          description: event.description,
        }));
      }
      return [];
    } catch (error) {
      throw new HttpException(
        'Erro ao buscar eventos do Zoho',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
