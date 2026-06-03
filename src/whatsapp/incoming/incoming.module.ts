import { Module } from '@nestjs/common';
import { IncomingService } from './incoming.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { WebhookModule } from '../webhook/webhook.module';
import { GatewayModule } from '../gateway/gateway.module';
import { AiProviderModule } from '../../ai-provider/ai-provider.module';
import { CredentialsModule } from '../credentials/credentials.module';

@Module({
  imports: [MessagingModule, WebhookModule, GatewayModule, AiProviderModule, CredentialsModule],
  controllers: [MetaWebhookController],
  providers: [IncomingService],
})
export class IncomingModule {}
