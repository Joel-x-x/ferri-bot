import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database/database.module';
import { SessionModule } from './whatsapp/session/session.module';
import { MessagingModule } from './whatsapp/messaging/messaging.module';
import { IncomingModule } from './whatsapp/incoming/incoming.module';
import { WebhookModule } from './whatsapp/webhook/webhook.module';
import { GatewayModule } from './whatsapp/gateway/gateway.module';
import { AiProviderModule } from './ai-provider/ai-provider.module';
import { envs } from './config/envs';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    JwtModule.register({
      global: true,
      secret: envs.jwt.secret,
      signOptions: { issuer: envs.jwt.issuer },
    }),
    DatabaseModule,
    GatewayModule,
    SessionModule,
    MessagingModule,
    IncomingModule,
    WebhookModule,
    AiProviderModule,
  ],
})
export class AppModule {}
