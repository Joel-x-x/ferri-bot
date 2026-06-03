import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageHistory } from '../../database/entities/message-history.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { SessionModule } from '../session/session.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageHistory]),
    SessionModule,
    GatewayModule,
  ],
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
