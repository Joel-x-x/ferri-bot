import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { proto } from '@whiskeysockets/baileys';
import axios from 'axios';
import {
  MessageHistory,
  MessageDirection,
  MessageType,
  MessageStatus,
} from '../../database/entities/message-history.entity';
import { SessionService } from '../session/session.service';
import { WhatsappGateway } from '../gateway/whatsapp.gateway';
import {
  SendTextDto,
} from './dto/send-text.dto';
import {
  SendImageDto,
  SendAudioDto,
  SendVideoDto,
  SendDocumentDto,
  SendReplyDto,
  SendReactionDto,
} from './dto/send-media.dto';
import { SendBulkDto } from './dto/send-bulk.dto';

const RATE_LIMIT_MS = 1000;

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(MessageHistory)
    private readonly messageRepo: Repository<MessageHistory>,
    private readonly sessionService: SessionService,
    private readonly gateway: WhatsappGateway,
  ) {}

  private normalizeJid(to: string): string {
    if (to.includes('@')) return to;
    return `${to}@s.whatsapp.net`;
  }

  private async saveOutbound(
    tenantId: string,
    jid: string,
    messageId: string,
    type: MessageType,
    content?: string,
    mediaUrl?: string,
    quotedMessageId?: string,
  ): Promise<void> {
    await this.messageRepo.save({
      tenantId,
      jid,
      messageId,
      direction: MessageDirection.OUTBOUND,
      type,
      content,
      mediaUrl,
      quotedMessageId,
      status: MessageStatus.SENT,
    });
  }

  async sendText(tenantId: string, dto: SendTextDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const result = await sock.sendMessage(jid, { text: dto.text });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.TEXT, dto.text);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, jid, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendImage(tenantId: string, dto: SendImageDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const { data } = await axios.get(dto.url, { responseType: 'arraybuffer' });
    const result = await sock.sendMessage(jid, {
      image: Buffer.from(data),
      caption: dto.caption,
    });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.IMAGE, dto.caption, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, jid, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendAudio(tenantId: string, dto: SendAudioDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const { data } = await axios.get(dto.url, { responseType: 'arraybuffer' });
    const result = await sock.sendMessage(jid, {
      audio: Buffer.from(data),
      mimetype: 'audio/mp4',
      ptt: dto.ptt ?? false,
    });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.AUDIO, undefined, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, jid, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendVideo(tenantId: string, dto: SendVideoDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const { data } = await axios.get(dto.url, { responseType: 'arraybuffer' });
    const result = await sock.sendMessage(jid, {
      video: Buffer.from(data),
      caption: dto.caption,
    });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.VIDEO, dto.caption, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, jid, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendDocument(tenantId: string, dto: SendDocumentDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const { data } = await axios.get(dto.url, { responseType: 'arraybuffer' });
    const result = await sock.sendMessage(jid, {
      document: Buffer.from(data),
      mimetype: dto.mimetype,
      fileName: dto.filename,
    });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.DOCUMENT, dto.filename, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, jid, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendReply(tenantId: string, dto: SendReplyDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const quoted: proto.IWebMessageInfo = {
      key: { remoteJid: jid, id: dto.quotedMessageId },
      message: { conversation: '' },
    };
    const result = await sock.sendMessage(jid, { text: dto.text }, { quoted });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.TEXT, dto.text, undefined, dto.quotedMessageId);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, jid, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendReaction(tenantId: string, dto: SendReactionDto): Promise<{ messageId: string }> {
    const sock = this.sessionService.getSocket(tenantId);
    const jid = this.normalizeJid(dto.to);
    const result = await sock.sendMessage(jid, {
      react: {
        text: dto.emoji,
        key: { remoteJid: jid, id: dto.messageId },
      },
    });
    const messageId = result?.key?.id ?? '';
    await this.saveOutbound(tenantId, jid, messageId, MessageType.REACTION, dto.emoji);
    return { messageId };
  }

  async sendBulk(tenantId: string, dto: SendBulkDto): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const item of dto.messages) {
      try {
        await this.sendText(tenantId, { to: item.to, text: item.text });
        sent++;
      } catch (err) {
        this.logger.warn(`Bulk send failed for ${item.to}: ${err.message}`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    return { sent, failed };
  }

  async getHistory(
    tenantId: string,
    jid: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: MessageHistory[]; total: number; page: number; limit: number }> {
    const normalizedJid = this.normalizeJid(jid);
    const [data, total] = await this.messageRepo.findAndCount({
      where: { tenantId, jid: normalizedJid },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async saveInbound(
    tenantId: string,
    jid: string,
    messageId: string,
    type: MessageType,
    content?: string,
    mediaUrl?: string,
    aiProcessed = false,
  ): Promise<void> {
    await this.messageRepo.save({
      tenantId,
      jid,
      messageId,
      direction: MessageDirection.INBOUND,
      type,
      content,
      mediaUrl,
      status: MessageStatus.READ,
      aiProcessed,
    });
  }
}
