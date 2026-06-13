import { Module } from '@nestjs/common';
import { ErpClientService } from './erp-client.service';

@Module({
  providers: [ErpClientService],
  exports: [ErpClientService],
})
export class ErpClientModule {}
