import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from '../config/envs';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { MessageHistory } from './entities/message-history.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { AiProvider } from './entities/ai-provider.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: envs.pg.host,
      port: envs.pg.port,
      username: envs.pg.username,
      password: envs.pg.password,
      database: envs.pg.database,
      entities: [WhatsappSession, MessageHistory, WebhookSubscription, AiProvider],
      synchronize: envs.nodeEnv === 'development',
      logging: false,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
