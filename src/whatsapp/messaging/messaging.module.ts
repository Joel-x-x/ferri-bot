import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageHistoryEntity } from '../../database/entities/message-history.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageHistoryEntity]),
    CredentialsModule,
    GatewayModule,
  ],
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
