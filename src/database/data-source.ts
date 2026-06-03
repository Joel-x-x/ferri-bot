import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { MetaCredentialsEntity } from './entities/meta-credentials.entity';
import { MessageHistoryEntity } from './entities/message-history.entity';
import { WebhookSubscriptionEntity } from './entities/webhook-subscription.entity';
import { AiProviderEntity } from './entities/ai-provider.entity';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  username: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  entities: [MetaCredentialsEntity, MessageHistoryEntity, WebhookSubscriptionEntity, AiProviderEntity],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
