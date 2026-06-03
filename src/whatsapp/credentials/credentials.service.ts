import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaCredentials } from '../../database/entities/meta-credentials.entity';
import { encrypt, decrypt } from '../../shared/utils/crypto.util';
import { envs } from '../../config/envs';
import { CreateCredentialsRequest, UpdateCredentialsRequest, CredentialsResponse } from './dto/credentials.dto';

@Injectable()
export class CredentialsService {
  constructor(
    @InjectRepository(MetaCredentials)
    private readonly repo: Repository<MetaCredentials>,
  ) {}

  async create(tenantId: string, dto: CreateCredentialsRequest): Promise<CredentialsResponse> {
    const existing = await this.repo.findOne({ where: { tenantId } });
    if (existing) throw new ConflictException('Credentials already exist for this tenant');
    const saved = await this.repo.save({
      ...dto,
      tenantId,
      accessToken: encrypt(dto.accessToken, envs.encryptionKey),
    });
    return this.sanitize(saved);
  }

  async findByTenant(tenantId: string): Promise<MetaCredentials> {
    const creds = await this.repo.findOne({ where: { tenantId } });
    if (!creds) throw new NotFoundException('No credentials found for this tenant');
    return { ...creds, accessToken: decrypt(creds.accessToken, envs.encryptionKey) } as MetaCredentials;
  }

  async findByTenantSafe(tenantId: string): Promise<CredentialsResponse> {
    const creds = await this.repo.findOne({ where: { tenantId } });
    if (!creds) throw new NotFoundException('No credentials found for this tenant');
    return this.sanitize(creds);
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<MetaCredentials | null> {
    const creds = await this.repo.findOne({ where: { phoneNumberId, isActive: true } });
    if (!creds) return null;
    creds.accessToken = decrypt(creds.accessToken, envs.encryptionKey);
    return creds;
  }

  async findByVerifyToken(verifyToken: string): Promise<MetaCredentials | null> {
    return this.repo.findOne({ where: { verifyToken, isActive: true } });
  }

  async update(tenantId: string, dto: UpdateCredentialsRequest): Promise<CredentialsResponse> {
    const creds = await this.repo.findOne({ where: { tenantId } });
    if (!creds) throw new NotFoundException('No credentials found for this tenant');
    if (dto.accessToken) {
      creds.accessToken = encrypt(dto.accessToken, envs.encryptionKey);
    }
    const { accessToken: _, ...rest } = dto;
    Object.assign(creds, rest);
    const saved = await this.repo.save(creds);
    return this.sanitize(saved);
  }

  async remove(tenantId: string): Promise<void> {
    const creds = await this.repo.findOne({ where: { tenantId } });
    if (!creds) throw new NotFoundException('No credentials found for this tenant');
    await this.repo.remove(creds);
  }

  private sanitize(entity: MetaCredentials): CredentialsResponse {
    const { accessToken: _, ...safe } = entity;
    return safe as CredentialsResponse;
  }
}
