import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderEntity } from '../database/entities/ai-provider.entity';
import { AiProviderService } from './ai-provider.service';
import { AiProviderController } from './ai-provider.controller';
import { AlgoliaModule } from '../algolia/algolia.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiProviderEntity]), AlgoliaModule],
  providers: [AiProviderService],
  controllers: [AiProviderController],
  exports: [AiProviderService],
})
export class AiProviderModule {}
