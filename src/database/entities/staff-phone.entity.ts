import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('staff_phones')
@Unique(['tenantId', 'phone'])
export class StaffPhoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', length: 100 })
  tenantId: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
