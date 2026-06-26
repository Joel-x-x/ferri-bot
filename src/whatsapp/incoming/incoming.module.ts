import { Module } from '@nestjs/common';
import { IncomingService } from './incoming.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { MessagingModule } from '../messaging/messaging.module';
import { WebhookModule } from '../webhook/webhook.module';
import { GatewayModule } from '../gateway/gateway.module';
import { AiProviderModule } from '../../ai-provider/ai-provider.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { StaffPhoneModule } from '../staff/staff-phone.module';
import { AgentModule } from '../../agent/agent.module';
import { MediaModule } from '../../media/media.module';

@Module({
  imports: [MessagingModule, WebhookModule, GatewayModule, AiProviderModule, CredentialsModule, StaffPhoneModule, AgentModule, MediaModule],
  controllers: [MetaWebhookController],
  providers: [IncomingService],
})
export class IncomingModule {}
