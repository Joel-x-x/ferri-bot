import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'message.status',
  'session.connected',
  'session.disconnected',
  'session.qr',
  'session.logged_out',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', length: 100 })
  tenantId: string;

  @Column({ length: 500 })
  url: string;

  @Column({ type: 'simple-array' })
  events: string[];

  @Column({ length: 200, nullable: true })
  secret: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
