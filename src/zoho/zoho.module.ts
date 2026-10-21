import { Module } from '@nestjs/common';
import { ZohoService } from './zoho.service';
import { ZohoController } from './zoho.controller';

@Module({
  controllers: [ZohoController],
  providers: [ZohoService],
  exports: [ZohoService],
})
export class ZohoModule {}
