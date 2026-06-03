import { Module } from '@nestjs/common';
import { IncomingService } from './incoming.service';
import { MessagingModule } from '../messaging/messaging.module';
import { WebhookModule } from '../webhook/webhook.module';
import { GatewayModule } from '../gateway/gateway.module';
import { AiProviderModule } from '../../ai-provider/ai-provider.module';

@Module({
  imports: [MessagingModule, WebhookModule, GatewayModule, AiProviderModule],
  providers: [IncomingService],
})
export class IncomingModule {}
