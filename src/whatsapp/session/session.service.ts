import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { toDataURL } from 'qrcode';
import pino from 'pino';
import {
  WhatsappSession,
  SessionStatus,
} from '../../database/entities/whatsapp-session.entity';
import { usePostgresAuthState } from './postgres-auth-state';
import { envs } from '../../config/envs';
import { WhatsappGateway } from '../gateway/whatsapp.gateway';

const MAX_RECONNECTS = 3;
const RECONNECT_DELAY_MS = 5000;

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private sockets = new Map<string, WASocket>();

  constructor(
    @InjectRepository(WhatsappSession)
    private readonly sessionRepo: Repository<WhatsappSession>,
    private readonly gateway: WhatsappGateway,
    private readonly emitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    const connected = await this.sessionRepo.find({
      where: { status: SessionStatus.CONNECTED },
    });
    for (const session of connected) {
      this.logger.log(`Restoring session for tenant ${session.tenantId}`);
      this.connect(session.tenantId, false).catch((err) =>
        this.logger.error(`Failed to restore ${session.tenantId}: ${err.message}`),
      );
    }
  }

  async startSession(tenantId: string): Promise<{ qr?: string; status: SessionStatus }> {
    const existing = await this.sessionRepo.findOne({ where: { tenantId } });

    if (existing?.status === SessionStatus.CONNECTED && this.sockets.has(tenantId)) {
      return { status: SessionStatus.CONNECTED };
    }

    if (!existing) {
      await this.sessionRepo.save({ tenantId, status: SessionStatus.PENDING });
    } else {
      await this.sessionRepo.update({ tenantId }, {
        status: SessionStatus.PENDING,
        qrCode: null,
        reconnectCount: 0,
      });
    }

    return this.connect(tenantId, true);
  }

  private async connect(
    tenantId: string,
    waitForQr: boolean,
  ): Promise<{ qr?: string; status: SessionStatus }> {
    const { state, saveCreds } = await usePostgresAuthState(
      tenantId,
      this.sessionRepo,
      envs.encryptionKey,
    );

    const { version } = await fetchLatestBaileysVersion();
    this.logger.log(`Baileys version: ${version.join('.')}`);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
    });

    this.sockets.set(tenantId, sock);

    return new Promise((resolve) => {
      let resolved = false;

      const done = (result: { qr?: string; status: SessionStatus }) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      if (!waitForQr) done({ status: SessionStatus.CONNECTING });

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          const qrBase64 = await toDataURL(qr);
          await this.sessionRepo.update({ tenantId }, {
            status: SessionStatus.QR_READY,
            qrCode: qrBase64,
          });
          this.gateway.emitToTenant(tenantId, 'session:qr', { tenantId, qr: qrBase64 });
          done({ qr: qrBase64, status: SessionStatus.QR_READY });
        }

        if (connection === 'open') {
          const phoneNumber = sock.user?.id?.split(':')[0] ?? null;
          await this.sessionRepo.update({ tenantId }, {
            status: SessionStatus.CONNECTED,
            phoneNumber,
            qrCode: null,
            reconnectCount: 0,
          });
          this.gateway.emitToTenant(tenantId, 'session:connected', { tenantId, phoneNumber });
          this.logger.log(`Session CONNECTED for tenant ${tenantId}`);
          done({ status: SessionStatus.CONNECTED });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            await this.sessionRepo.update({ tenantId }, {
              status: SessionStatus.LOGGED_OUT,
              authState: null,
              qrCode: null,
            });
            this.sockets.delete(tenantId);
            this.gateway.emitToTenant(tenantId, 'session:logged_out', { tenantId });
            this.logger.warn(`Session LOGGED_OUT for tenant ${tenantId}`);
            done({ status: SessionStatus.LOGGED_OUT });
          } else {
            const session = await this.sessionRepo.findOne({ where: { tenantId } });
            const count = session?.reconnectCount ?? 0;

            if (count < MAX_RECONNECTS) {
              await this.sessionRepo.update({ tenantId }, {
                status: SessionStatus.DISCONNECTED,
                reconnectCount: count + 1,
              });
              this.gateway.emitToTenant(tenantId, 'session:disconnected', {
                tenantId,
                reason: 'connection_closed',
                attempt: count + 1,
              });
              this.logger.warn(`Session DISCONNECTED for ${tenantId}, retrying (${count + 1}/${MAX_RECONNECTS})`);
              setTimeout(() => this.connect(tenantId, false), RECONNECT_DELAY_MS);
            } else {
              await this.sessionRepo.update({ tenantId }, { status: SessionStatus.LOGGED_OUT });
              this.sockets.delete(tenantId);
              this.gateway.emitToTenant(tenantId, 'session:logged_out', {
                tenantId,
                reason: 'max_reconnects_reached',
              });
            }
            done({ status: SessionStatus.DISCONNECTED });
          }
        }
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg.key.fromMe && msg.message) {
            this.emitter.emit('whatsapp.message.received', { tenantId, message: msg });
          }
        }
      });

      sock.ev.on('message-receipt.update', (updates) => {
        for (const update of updates) {
          const status = update.receipt.readTimestamp ? 'READ' : 'DELIVERED';
          this.emitter.emit('whatsapp.message.status', {
            tenantId,
            messageId: update.key.id,
            status,
          });
          this.gateway.emitToTenant(tenantId, 'message:status', {
            tenantId,
            messageId: update.key.id,
            status,
          });
        }
      });

      if (waitForQr) {
        setTimeout(() => done({ status: SessionStatus.PENDING }), 60_000);
      }
    });
  }

  getSocket(tenantId: string): WASocket {
    const sock = this.sockets.get(tenantId);
    if (!sock) throw new NotFoundException(`No active session for tenant ${tenantId}`);
    return sock;
  }

  hasSocket(tenantId: string): boolean {
    return this.sockets.has(tenantId);
  }

  async getStatus(tenantId: string): Promise<WhatsappSession> {
    const session = await this.sessionRepo.findOne({ where: { tenantId } });
    if (!session) throw new NotFoundException(`Session not found for tenant ${tenantId}`);
    return session;
  }

  async logout(tenantId: string): Promise<void> {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      try {
        await sock.logout();
      } catch {}
      this.sockets.delete(tenantId);
    }
    await this.sessionRepo.update({ tenantId }, {
      status: SessionStatus.LOGGED_OUT,
      authState: null,
      qrCode: null,
      reconnectCount: 0,
    });
  }

  async reconnect(tenantId: string): Promise<{ qr?: string; status: SessionStatus }> {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      try { sock.end(undefined); } catch {}
      this.sockets.delete(tenantId);
    }
    await this.sessionRepo.update({ tenantId }, { reconnectCount: 0 });
    return this.connect(tenantId, true);
  }

  async onModuleDestroy() {
    for (const [, sock] of this.sockets) {
      try { sock.end(undefined); } catch {}
    }
  }
}
