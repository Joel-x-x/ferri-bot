import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database/database.module';
import { CredentialsModule } from './whatsapp/credentials/credentials.module';
import { MessagingModule } from './whatsapp/messaging/messaging.module';
import { IncomingModule } from './whatsapp/incoming/incoming.module';
import { WebhookModule } from './whatsapp/webhook/webhook.module';
import { GatewayModule } from './whatsapp/gateway/gateway.module';
import { AiProviderModule } from './ai-provider/ai-provider.module';
import { HealthModule } from './health/health.module';
import { StaffPhoneModule } from './whatsapp/staff/staff-phone.module';
import { AgentModule } from './agent/agent.module';
import { MediaModule } from './media/media.module';
import { envs } from './config/envs';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: envs.jwt.secret,
      signOptions: { issuer: envs.jwt.issuer },
    }),
    DatabaseModule,
    GatewayModule,
    CredentialsModule,
    MessagingModule,
    IncomingModule,
    WebhookModule,
    AiProviderModule,
    StaffPhoneModule,
    AgentModule,
    MediaModule,
    HealthModule,
  ],
})
export class AppModule {}
