import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaCredentials } from '../../database/entities/meta-credentials.entity';
import { CreateCredentialsDto, UpdateCredentialsDto } from './dto/credentials.dto';

@Injectable()
export class CredentialsService {
  constructor(
    @InjectRepository(MetaCredentials)
    private readonly repo: Repository<MetaCredentials>,
  ) {}

  async create(tenantId: string, dto: CreateCredentialsDto): Promise<MetaCredentials> {
    const existing = await this.repo.findOne({ where: { tenantId } });
    if (existing) throw new ConflictException('Credentials already exist for this tenant');
    return this.repo.save({ ...dto, tenantId });
  }

  async findByTenant(tenantId: string): Promise<MetaCredentials> {
    const creds = await this.repo.findOne({ where: { tenantId } });
    if (!creds) throw new NotFoundException('No credentials found for this tenant');
    return creds;
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<MetaCredentials | null> {
    return this.repo.findOne({ where: { phoneNumberId, isActive: true } });
  }

  async findByVerifyToken(verifyToken: string): Promise<MetaCredentials | null> {
    return this.repo.findOne({ where: { verifyToken, isActive: true } });
  }

  async update(tenantId: string, dto: UpdateCredentialsDto): Promise<MetaCredentials> {
    const creds = await this.findByTenant(tenantId);
    Object.assign(creds, dto);
    return this.repo.save(creds);
  }

  async remove(tenantId: string): Promise<void> {
    const creds = await this.findByTenant(tenantId);
    await this.repo.remove(creds);
  }
}
