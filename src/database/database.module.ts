import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from '../config/envs';
import { MetaCredentialsEntity } from './entities/meta-credentials.entity';
import { MessageHistoryEntity } from './entities/message-history.entity';
import { WebhookSubscriptionEntity } from './entities/webhook-subscription.entity';
import { AiProviderEntity } from './entities/ai-provider.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: envs.pg.host,
      port: envs.pg.port,
      username: envs.pg.username,
      password: envs.pg.password,
      database: envs.pg.database,
      entities: [MetaCredentialsEntity, MessageHistoryEntity, WebhookSubscriptionEntity, AiProviderEntity],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: false,
      migrationsRun: true,
      logging: false,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
