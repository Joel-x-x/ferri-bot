import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider } from '../database/entities/ai-provider.entity';
import { encrypt, decrypt } from '../shared/utils/crypto.util';
import { envs } from '../config/envs';
import { AiProviderFactory } from './ai-provider.factory';
import { AiMessage } from './adapters/ai-adapter.interface';
import { UpsertAiProviderRequest, UpdateAiProviderRequest } from './dto/ai-provider.dto';

@Injectable()
export class AiProviderService {
  constructor(
    @InjectRepository(AiProvider)
    private readonly providerRepo: Repository<AiProvider>,
  ) {}

  async upsert(tenantId: string, dto: UpsertAiProviderRequest): Promise<Omit<AiProvider, 'apiKey'>> {
    let entity = await this.providerRepo.findOne({ where: { tenantId } });

    const encryptedKey = encrypt(dto.apiKey, envs.encryptionKey);

    if (entity) {
      Object.assign(entity, { ...dto, apiKey: encryptedKey });
    } else {
      entity = this.providerRepo.create({ ...dto, tenantId, apiKey: encryptedKey });
    }

    const saved = await this.providerRepo.save(entity);
    return this.sanitize(saved);
  }

  async getProvider(tenantId: string): Promise<AiProvider | null> {
    return this.providerRepo.findOne({ where: { tenantId } });
  }

  async getProviderSafe(tenantId: string): Promise<Omit<AiProvider, 'apiKey'> | null> {
    const entity = await this.providerRepo.findOne({ where: { tenantId } });
    return entity ? this.sanitize(entity) : null;
  }

  async update(tenantId: string, dto: UpdateAiProviderRequest): Promise<Omit<AiProvider, 'apiKey'>> {
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
    return adapter.chat(messages, systemPrompt ?? entity.systemPrompt);
  }

  /**
   * Single-query path for auto-reply flow.
   * Returns null if provider not found, inactive, or autoReply disabled.
   * Avoids the double findOne that getProvider() + chat() would require.
   */
  async chatIfAutoReply(
    tenantId: string,
    messages: AiMessage[],
  ): Promise<string | null> {
    const entity = await this.providerRepo.findOne({ where: { tenantId, isActive: true } });
    if (!entity?.autoReply) return null;

    const decryptedKey = decrypt(entity.apiKey, envs.encryptionKey);
    const adapter = AiProviderFactory.create(entity, decryptedKey);
    return adapter.chat(messages, entity.systemPrompt);
  }

  private sanitize(entity: AiProvider): Omit<AiProvider, 'apiKey'> {
    const { apiKey, ...safe } = entity;
    return safe;
  }
}
