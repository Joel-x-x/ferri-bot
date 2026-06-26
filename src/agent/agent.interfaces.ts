import { AiTool, AiToolExecutor } from '../ai-provider/adapters/ai-adapter.interface';

export type AgentType = 'INTERNAL' | 'EXTERNAL';

export interface ToolDefinition {
  tool: AiTool;
  privileges: string[];
  /** Only available to internal agent (staff) */
  internal?: boolean;
  /** Only available to linked contacts (external agent) */
  linked?: boolean;
}

export interface AgentContext {
  tenantId: string;
  contactPhone: string;
  salesPhone: string | null;
  isStaff: boolean;
  authorities: string[];
  isLinkedContact: boolean;
  erpBaseUrl?: string;
  erpApiKey?: string;
  tenantCustomPrompt?: string;
}

export interface ResolvedAgent {
  agentType: AgentType;
  systemPrompt: string;
  tools: AiTool[];
  toolExecutor: AiToolExecutor;
}
