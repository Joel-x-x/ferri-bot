import { Injectable } from '@nestjs/common';
import { AiTool, AiToolExecutor, AiToolExecutorResult } from '../ai-provider/adapters/ai-adapter.interface';
import { AgentContext, AgentType, ToolDefinition } from './agent.interfaces';
import { AlgoliaService } from '../algolia/algolia.service';
import { ErpClientService } from '../erp/erp-client.service';

import { searchProductsTool } from './tools/catalog/search-products.tool';
import { searchProductsErpTool } from './tools/catalog/search-products-erp.tool';
import { sendQuotationTool } from './tools/sales/send-quotation.tool';
import { notifyAdvisorTool } from './tools/shared/notify-advisor.tool';

@Injectable()
export class ToolRegistryService {
  private readonly definitions: ToolDefinition[] = [
    searchProductsTool,
    searchProductsErpTool,
    sendQuotationTool,
    notifyAdvisorTool,
  ];

  constructor(
    private readonly algoliaService: AlgoliaService,
    private readonly erpClientService: ErpClientService,
  ) {}

  resolveTools(agentType: AgentType, context: AgentContext): AiTool[] {
    return this.definitions
      .filter((def) => this.isAvailable(def, agentType, context))
      .map((def) => def.tool);
  }

  createExecutor(context: AgentContext): AiToolExecutor {
    return {
      execute: (name, args) => this.executeTool(name, args, context),
    };
  }

  private isAvailable(def: ToolDefinition, agentType: AgentType, context: AgentContext): boolean {
    if (agentType === 'EXTERNAL') {
      if (def.internal) return false;
      if (def.privileges.length > 0) return false;
      if (def.linked && !context.isLinkedContact) return false;
    }

    return def.privileges.every((p) => context.authorities.includes(p));
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: AgentContext,
  ): Promise<AiToolExecutorResult> {
    switch (name) {
      case 'search_products': {
        const query = String(args['query'] ?? '');
        const hits = await this.algoliaService.searchProducts(query, context.tenantId);
        const content = this.algoliaService.formatProductsForAi(hits);
        const imageUrl = hits[0]?.imageUrl;
        return { content, imageUrl };
      }

      case 'search_products_erp': {
        const query = String(args['query'] ?? '');
        if (!context.erpBaseUrl || !context.erpApiKey) {
          return { content: 'ERP no configurado para este tenant. Consulta el sistema directamente.' };
        }
        const result = await this.erpClientService.searchProducts(
          context.erpBaseUrl,
          context.erpApiKey,
          query,
        );
        return { content: this.erpClientService.formatForSecretary(result.items) };
      }

      case 'send_quotation': {
        const items = String(args['items'] ?? '');
        const total = String(args['total'] ?? 'No disponible');
        return {
          content: 'Cotización enviada al asesor.',
          vendorNotification: { type: 'quotation', items, total, clientPhone: context.contactPhone },
        };
      }

      case 'notify_advisor': {
        const summary = String(args['summary'] ?? 'El cliente solicita atención de un asesor.');
        return {
          content: 'Asesor notificado.',
          vendorNotification: { type: 'handoff', summary, clientPhone: context.contactPhone },
        };
      }

      default:
        return { content: `Tool "${name}" not found.` };
    }
  }
}
