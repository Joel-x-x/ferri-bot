import { Injectable } from '@nestjs/common';
import { AgentContext, AgentType, ResolvedAgent } from './agent.interfaces';
import { ToolRegistryService } from './tool-registry.service';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class AgentResolverService {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  resolve(context: AgentContext): ResolvedAgent {
    const agentType: AgentType = context.isStaff ? 'INTERNAL' : 'EXTERNAL';
    const tools = this.toolRegistry.resolveTools(agentType, context);
    const toolExecutor = this.toolRegistry.createExecutor(context);
    const systemPrompt = this.promptBuilder.build(
      agentType,
      context.salesPhone,
      context.tenantCustomPrompt,
    );

    return { agentType, systemPrompt, tools, toolExecutor };
  }
}
