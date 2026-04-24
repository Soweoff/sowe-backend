import { Module } from '@nestjs/common';
import { ZohoService } from './zoho.service';
import { ZohoController } from './zoho.controller';

@Module({
  controllers: [ZohoController],
  providers: [ZohoService],
})
export class ZohoModule {}
