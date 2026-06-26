import { Module } from '@nestjs/common';
import { AgentResolverService } from './agent-resolver.service';
import { ToolRegistryService } from './tool-registry.service';
import { PromptBuilderService } from './prompt-builder.service';
import { AlgoliaModule } from '../algolia/algolia.module';
import { ErpClientModule } from '../erp/erp-client.module';

@Module({
  imports: [AlgoliaModule, ErpClientModule],
  providers: [AgentResolverService, ToolRegistryService, PromptBuilderService],
  exports: [AgentResolverService],
})
export class AgentModule {}
