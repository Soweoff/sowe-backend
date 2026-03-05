import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MondayService {
  async getTasks() {
    const query = `
      query {
        boards(ids: 18402272661) {
          items_page {
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
          Authorization: process.env.MONDAY_TOKEN,
        },
      },
    );

    return response.data;
  }
}
