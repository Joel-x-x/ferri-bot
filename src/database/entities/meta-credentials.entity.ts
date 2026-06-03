import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('meta_credentials')
export class MetaCredentials {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', unique: true, length: 100 })
  tenantId: string;

  @Index()
  @Column({ name: 'phone_number_id', unique: true, length: 50 })
  phoneNumberId: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'waba_id', length: 50 })
  wabaId: string;

  @Index()
  @Column({ name: 'verify_token', length: 100 })
  verifyToken: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
