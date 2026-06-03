import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AiProviderType {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  CUSTOM = 'CUSTOM',
}

@Entity('ai_providers')
export class AiProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', unique: true, length: 100 })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  provider: AiProviderType;

  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey: string;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string;

  @Column({ name: 'base_url', length: 500, nullable: true })
  baseUrl: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'auto_reply', default: false })
  autoReply: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
