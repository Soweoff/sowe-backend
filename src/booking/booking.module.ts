import { Module } from '@nestjs/common';
import { ZohoModule } from '../zoho/zoho.module';
import { BookingService } from './booking.service';
import {
  BookingAdminController,
  BookingController,
} from './booking.controller';

@Module({
  imports: [ZohoModule],
  controllers: [BookingController, BookingAdminController],
  providers: [BookingService],
})
export class BookingModule {}
