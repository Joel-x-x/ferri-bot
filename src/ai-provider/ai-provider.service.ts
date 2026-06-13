import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProviderEntity } from '../database/entities/ai-provider.entity';
import { encrypt, decrypt } from '../shared/utils/crypto.util';
import { envs } from '../config/envs';
import { AiProviderFactory } from './ai-provider.factory';
import { AiChatResult, AiMessage, AiTool, AiToolExecutor } from './adapters/ai-adapter.interface';
import { UpsertAiProviderRequest, UpdateAiProviderRequest } from './dto/ai-provider.dto';
import { AlgoliaService } from '../algolia/algolia.service';
import { ErpClientService } from '../erp/erp-client.service';

function buildBasePrompt(salesPhone: string, isStaff = false): string {
  const staffRules = isStaff ? `
MODO SECRETARIO (uso interno — no compartir esta información con clientes):
- Siempre muestra costo, precio mayorista y PVP claramente diferenciados.
- Usa search_products_erp para obtener precios internos completos.
- Si no tienes acceso al ERP o hay error, indica al usuario que consulte el sistema directamente.
` : '';

  return `Eres FerriBot, asistente virtual de atención al cliente de una ferretería. Siempre identifícate como bot si te lo preguntan.

REGLAS DE RESPUESTA:
- Respuestas cortas y concretas por defecto. Solo da detalles si el cliente los pide explícitamente.
- Usa formato WhatsApp: negrillas pegadas al texto *así*, no * así *.
- Precios son siempre referenciales, nunca garantizados.

BÚSQUEDA DE PRODUCTOS:
- Cuando el cliente pregunte por precios, disponibilidad o productos, usa search_products.
- Muestra máximo 5 resultados.
- Si hay imagen del producto principal, se enviará automáticamente.

COTIZACIÓN:
- Acumula los productos que el cliente pide cotizar a lo largo de la conversación.
- Cuando el cliente indique que terminó, presenta el resumen con la lista de productos, cantidades y total estimado.
- Luego pregunta: "¿Deseas que envíe esta cotización a un asesor?"
- Si responde que sí, llama a la herramienta send_quotation con los detalles y confirma: "✅ Cotización enviada. Un asesor te contactará pronto."

HANDOFF AL ASESOR:
- Cuando el cliente pida hablar con una persona, un asesor, o soporte humano, SIEMPRE llama primero a la herramienta notify_advisor con un resumen breve de lo que necesita.
- Después de llamar notify_advisor responde: "Listo, ya avisé a nuestro equipo. En breve te contactan al *${salesPhone}* o puedes escribirles directamente."
- NUNCA des el handoff solo con texto sin llamar notify_advisor.${staffRules}`;
}

const SEARCH_PRODUCTS_TOOL: AiTool = {
  name: 'search_products',
  description: 'Busca productos en el catálogo de la ferretería por nombre, categoría o descripción. Úsala cuando el cliente pregunte sobre precios, disponibilidad o productos específicos.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Término de búsqueda: nombre del producto, categoría o descripción',
      },
    },
    required: ['query'],
  },
};

const SEND_QUOTATION_TOOL: AiTool = {
  name: 'send_quotation',
  description: 'Envía la cotización confirmada al asesor de ventas. Llama esta herramienta solo cuando el cliente haya confirmado explícitamente que desea enviar la cotización.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'string',
        description: 'Lista de productos con cantidades, uno por línea. Ej: "Cemento Chimborazo × 3\\nTornillo hex 1/2 × 100"',
      },
      total: {
        type: 'string',
        description: 'Total estimado en formato "$XX.XX" o "No disponible" si no se pudo calcular',
      },
    },
    required: ['items', 'total'],
  },
};

const NOTIFY_ADVISOR_TOOL: AiTool = {
  name: 'notify_advisor',
  description: 'Notifica al asesor humano que un cliente solicita atención personalizada. Llama esta herramienta SIEMPRE que el cliente pida hablar con una persona, un asesor, o soporte humano.',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Resumen breve de lo que el cliente necesita o preguntó, para que el asesor tenga contexto antes de contactarlo.',
      },
    },
    required: ['summary'],
  },
};

const SEARCH_PRODUCTS_ERP_TOOL: AiTool = {
  name: 'search_products_erp',
  description: 'Busca productos en el ERP interno con precios completos (costo, mayorista, PVP). Úsala cuando necesites precios internos para cotizaciones internas o consultas de staff.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Término de búsqueda: nombre del producto, categoría o descripción',
      },
    },
    required: ['query'],
  },
};

@Injectable()
export class AiProviderService {
  constructor(
    @InjectRepository(AiProviderEntity)
    private readonly providerRepo: Repository<AiProviderEntity>,
    private readonly algoliaService: AlgoliaService,
    private readonly erpClientService: ErpClientService,
  ) {}

  async upsert(
    tenantId: string,
    dto: UpsertAiProviderRequest,
  ): Promise<{ data: Omit<AiProviderEntity, 'apiKey'>; created: boolean }> {
    let entity = await this.providerRepo.findOne({ where: { tenantId } });
    const created = !entity;
    const encryptedKey = encrypt(dto.apiKey, envs.encryptionKey);

    if (entity) {
      Object.assign(entity, { ...dto, apiKey: encryptedKey });
    } else {
      entity = this.providerRepo.create({ ...dto, tenantId, apiKey: encryptedKey });
    }

    const saved = await this.providerRepo.save(entity);
    return { data: this.sanitize(saved), created };
  }

  async getProvider(tenantId: string): Promise<AiProviderEntity | null> {
    return this.providerRepo.findOne({ where: { tenantId } });
  }

  async getProviderSafe(tenantId: string): Promise<Omit<AiProviderEntity, 'apiKey'> | null> {
    const entity = await this.providerRepo.findOne({ where: { tenantId } });
    return entity ? this.sanitize(entity) : null;
  }

  async update(tenantId: string, dto: UpdateAiProviderRequest): Promise<Omit<AiProviderEntity, 'apiKey'>> {
    const entity = await this.providerRepo.findOne({ where: { tenantId } });
    if (!entity) throw new NotFoundException(`AI provider not found for tenant ${tenantId}`);

    if (dto.apiKey) {
      entity.apiKey = encrypt(dto.apiKey, envs.encryptionKey);
    }

    const { apiKey: _, ...rest } = dto;
    Object.assign(entity, rest);

    const saved = await this.providerRepo.save(entity);
    return this.sanitize(saved);
  }

  async remove(tenantId: string): Promise<void> {
    const entity = await this.providerRepo.findOne({ where: { tenantId } });
    if (!entity) throw new NotFoundException(`AI provider not found for tenant ${tenantId}`);
    await this.providerRepo.remove(entity);
  }

  async chat(
    tenantId: string,
    messages: AiMessage[],
    systemPrompt?: string,
  ): Promise<string> {
    const entity = await this.providerRepo.findOne({ where: { tenantId, isActive: true } });
    if (!entity) throw new NotFoundException(`No active AI provider for tenant ${tenantId}`);

    const decryptedKey = decrypt(entity.apiKey, envs.encryptionKey);
    const adapter = AiProviderFactory.create(entity, decryptedKey);
    try {
      const result = await adapter.chat(messages, systemPrompt ?? entity.systemPrompt);
      return result.text;
    } catch (err) {
      throw new HttpException(
        this.extractAiError(err),
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private extractAiError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests'))
      return 'AI provider quota exceeded — check your plan or billing';
    if (msg.includes('401') || msg.includes('API key') || msg.includes('invalid'))
      return 'AI provider API key invalid or unauthorized';
    if (msg.includes('404') || msg.includes('not found'))
      return `AI model not found — check the model name in your provider config`;
    if (msg.includes('503') || msg.includes('overloaded'))
      return 'AI provider temporarily unavailable — try again later';
    return `AI provider error: ${msg}`;
  }

  /**
   * Auto-reply path: includes Algolia search + quotation tools.
   * Returns null if provider not found, inactive, or autoReply disabled.
   */
  async chatIfAutoReply(
    tenantId: string,
    messages: AiMessage[],
    contactPhone: string,
    salesPhone: string | null,
    isStaff = false,
    erpBaseUrl?: string,
    erpApiKey?: string,
  ): Promise<AiChatResult | null> {
    const entity = await this.providerRepo.findOne({ where: { tenantId, isActive: true } });
    if (!entity?.autoReply) return null;

    const decryptedKey = decrypt(entity.apiKey, envs.encryptionKey);
    const adapter = AiProviderFactory.create(entity, decryptedKey);

    const basePrompt = buildBasePrompt(salesPhone ?? '', isStaff);
    const systemPrompt = [basePrompt, entity.systemPrompt]
      .filter(Boolean)
      .join('\n\n');

    const toolExecutor: AiToolExecutor = {
      execute: async (name, args) => {
        if (name === 'search_products') {
          const query = String(args['query'] ?? '');
          const hits = await this.algoliaService.searchProducts(query, tenantId);
          const content = this.algoliaService.formatProductsForAi(hits);
          const imageUrl = hits[0]?.imageUrl;
          return { content, imageUrl };
        }

        if (name === 'search_products_erp') {
          const query = String(args['query'] ?? '');
          if (!erpBaseUrl || !erpApiKey) {
            return { content: 'ERP no configurado para este tenant. Consulta el sistema directamente.' };
          }
          const result = await this.erpClientService.searchProducts(erpBaseUrl, erpApiKey, query);
          return { content: this.erpClientService.formatForSecretary(result.items) };
        }

        if (name === 'send_quotation') {
          const items = String(args['items'] ?? '');
          const total = String(args['total'] ?? 'No disponible');
          return {
            content: 'Cotización enviada al asesor.',
            vendorNotification: { type: 'quotation', items, total, clientPhone: contactPhone },
          };
        }

        if (name === 'notify_advisor') {
          const summary = String(args['summary'] ?? 'El cliente solicita atención de un asesor.');
          return {
            content: 'Asesor notificado.',
            vendorNotification: { type: 'handoff', summary, clientPhone: contactPhone },
          };
        }

        return { content: `Tool "${name}" not found.` };
      },
    };

    const tools = isStaff
      ? [SEARCH_PRODUCTS_TOOL, SEARCH_PRODUCTS_ERP_TOOL, SEND_QUOTATION_TOOL, NOTIFY_ADVISOR_TOOL]
      : [SEARCH_PRODUCTS_TOOL, SEND_QUOTATION_TOOL, NOTIFY_ADVISOR_TOOL];

    return adapter.chat(messages, systemPrompt, tools, toolExecutor);
  }

  private sanitize(entity: AiProviderEntity): Omit<AiProviderEntity, 'apiKey'> {
    const { apiKey, ...safe } = entity;
    return safe;
  }
}
