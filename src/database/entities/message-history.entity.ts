import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  STICKER = 'STICKER',
  REACTION = 'REACTION',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

@Entity('message_history')
@Index(['tenantId', 'jid'])
@Index(['tenantId', 'createdAt'])
export class MessageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', length: 100 })
  tenantId: string;

  @Column({ length: 100 })
  jid: string;

  @Column({ name: 'message_id', length: 100, nullable: true })
  messageId: string;

  @Column({ type: 'enum', enum: MessageDirection })
  direction: MessageDirection;

  @Column({ type: 'enum', enum: MessageType })
  type: MessageType;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ name: 'media_url', length: 500, nullable: true })
  mediaUrl: string;

  @Column({ name: 'quoted_message_id', length: 100, nullable: true })
  quotedMessageId: string;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.PENDING })
  status: MessageStatus;

  @Column({ name: 'ai_processed', default: false })
  aiProcessed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
