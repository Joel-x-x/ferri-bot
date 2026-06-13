import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffPhoneEntity } from '../../database/entities/staff-phone.entity';
import { CreateStaffPhoneRequest, UpdateStaffPhoneRequest } from './dto/staff-phone.dto';

@Injectable()
export class StaffPhoneService {
  constructor(
    @InjectRepository(StaffPhoneEntity)
    private readonly repo: Repository<StaffPhoneEntity>,
  ) {}

  async isStaff(tenantId: string, phone: string): Promise<boolean> {
    const count = await this.repo.count({ where: { tenantId, phone, isActive: true } });
    return count > 0;
  }

  async list(tenantId: string): Promise<StaffPhoneEntity[]> {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async add(tenantId: string, dto: CreateStaffPhoneRequest): Promise<StaffPhoneEntity> {
    const existing = await this.repo.findOne({ where: { tenantId, phone: dto.phone } });
    if (existing) throw new ConflictException(`Phone ${dto.phone} already registered for this tenant`);
    return this.repo.save({ tenantId, phone: dto.phone, name: dto.name });
  }

  async update(id: string, tenantId: string, dto: UpdateStaffPhoneRequest): Promise<StaffPhoneEntity> {
    const entity = await this.findOrThrow(id, tenantId);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const entity = await this.findOrThrow(id, tenantId);
    await this.repo.remove(entity);
  }

  private async findOrThrow(id: string, tenantId: string): Promise<StaffPhoneEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException(`Staff phone not found: ${id}`);
    return entity;
  }
}
