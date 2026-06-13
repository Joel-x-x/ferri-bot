import { Module } from '@nestjs/common';
import { IncomingService } from './incoming.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { WebhookModule } from '../webhook/webhook.module';
import { GatewayModule } from '../gateway/gateway.module';
import { AiProviderModule } from '../../ai-provider/ai-provider.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { StaffPhoneModule } from '../staff/staff-phone.module';

@Module({
  imports: [MessagingModule, WebhookModule, GatewayModule, AiProviderModule, CredentialsModule, StaffPhoneModule],
  controllers: [MetaWebhookController],
  providers: [IncomingService],
})
export class IncomingModule {}
