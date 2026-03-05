import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MondayService {
  async getTasks() {
    try {
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
            Authorization: process.env.MONDAY_TOKEN,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      console.log('MONDAY ERROR ↓↓↓');

      if (error.response) {
        console.log(error.response.data);
      } else {
        console.log(error.message);
      }

      throw error;
    }
  }
}
