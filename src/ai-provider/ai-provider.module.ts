import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderEntity } from '../database/entities/ai-provider.entity';
import { AiProviderEntityService } from './ai-provider.service';
import { AiProviderEntityController } from './ai-provider.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiProviderEntity])],
  providers: [AiProviderEntityService],
  controllers: [AiProviderEntityController],
  exports: [AiProviderEntityService],
})
export class AiProviderEntityModule {}
