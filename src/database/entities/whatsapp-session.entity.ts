import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SessionStatus {
  PENDING = 'PENDING',
  QR_READY = 'QR_READY',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  LOGGED_OUT = 'LOGGED_OUT',
}

@Entity('whatsapp_sessions')
export class WhatsappSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', unique: true, length: 100 })
  tenantId: string;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.PENDING })
  status: SessionStatus;

  @Column({ name: 'auth_state', type: 'text', nullable: true })
  authState: string;

  @Column({ name: 'phone_number', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @Column({ name: 'reconnect_count', default: 0 })
  reconnectCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
