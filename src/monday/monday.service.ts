import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MondayService {
  constructor(private configService: ConfigService) {}

  async getTasks() {
    const token = this.configService.get<string>('MONDAY_TOKEN');

    const query = `
      query {
        boards(ids: 18402272661) {
          items_page(limit: 50) {
            items {
              id
              name
            }
          }
        }
      }
    `;

    const response = await axios.post(
      'https://api.monday.com/v2',
      { query },
      {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  }
}
