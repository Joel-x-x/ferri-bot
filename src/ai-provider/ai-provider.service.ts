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

@Injectable()
export class AiProviderService {
  constructor(
    @InjectRepository(AiProviderEntity)
    private readonly providerRepo: Repository<AiProviderEntity>,
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

  /**
   * Auto-reply path: uses pre-resolved agent (tools + prompt from AgentResolver).
   * Returns null if provider not found, inactive, or autoReply disabled.
   */
  async chatWithAgent(
    tenantId: string,
    messages: AiMessage[],
    systemPrompt: string,
    tools: AiTool[],
    toolExecutor: AiToolExecutor,
  ): Promise<AiChatResult | null> {
    const entity = await this.providerRepo.findOne({ where: { tenantId, isActive: true } });
    if (!entity?.autoReply) return null;

    const decryptedKey = decrypt(entity.apiKey, envs.encryptionKey);
    const adapter = AiProviderFactory.create(entity, decryptedKey);

    const fullPrompt = [systemPrompt, entity.systemPrompt]
      .filter(Boolean)
      .join('\n\n');

    return adapter.chat(messages, fullPrompt, tools, toolExecutor);
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

  private sanitize(entity: AiProviderEntity): Omit<AiProviderEntity, 'apiKey'> {
    const { apiKey, ...safe } = entity;
    return safe;
  }
}
