import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosError } from 'axios';
import {
  MessageHistoryEntity,
  MessageDirection,
  MessageType,
  MessageStatus,
} from '../../database/entities/message-history.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { WhatsappGateway } from '../gateway/whatsapp.gateway';
import { SendTextRequest } from './dto/send-text.dto';
import {
  SendImageRequest,
  SendAudioRequest,
  SendVideoRequest,
  SendDocumentRequest,
  SendReplyRequest,
  SendReactionRequest,
} from './dto/send-media.dto';
import { SendBulkRequest } from './dto/send-bulk.dto';
import { envs } from '../../config/envs';

const RATE_LIMIT_MS = 1000;
const GRAPH_URL = `https://graph.facebook.com/${envs.meta.apiVersion}`;

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(MessageHistoryEntity)
    private readonly messageRepo: Repository<MessageHistoryEntity>,
    private readonly credentialsService: CredentialsService,
    private readonly gateway: WhatsappGateway,
  ) {}

  private async graphPost(phoneNumberId: string, accessToken: string, body: object): Promise<string> {
    const url = `${GRAPH_URL}/${phoneNumberId}/messages`;
    try {
      const { data } = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      });
      return data?.messages?.[0]?.id ?? '';
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const metaError = axiosErr.response?.data?.error;
      const status = axiosErr.response?.status;

      if (status === 401) {
        throw new UnauthorizedException('Meta access token invalid or expired');
      }
      if (status === 400) {
        throw new BadRequestException(metaError?.message ?? 'Invalid message payload');
      }
      if (status === 429) {
        throw new HttpException('Meta API rate limit exceeded — try again later', HttpStatus.TOO_MANY_REQUESTS);
      }
      this.logger.error(`meta.graph_post_failed status=${status} error=${metaError?.message ?? err.message}`);
      throw err;
    }
  }

  private async saveOutbound(
    tenantId: string,
    to: string,
    messageId: string,
    type: MessageType,
    content?: string,
    mediaUrl?: string,
    quotedMessageId?: string,
  ): Promise<void> {
    await this.messageRepo.save({
      tenantId,
      contactPhone: to,
      messageId,
      direction: MessageDirection.OUTBOUND,
      type,
      content,
      mediaUrl,
      quotedMessageId,
      status: MessageStatus.SENT,
    });
  }

  async sendText(tenantId: string, dto: SendTextRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      type: 'text',
      text: { body: dto.text },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.TEXT, dto.text);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: dto.to, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendImage(tenantId: string, dto: SendImageRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      type: 'image',
      image: { link: dto.url, caption: dto.caption },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.IMAGE, dto.caption, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: dto.to, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendAudio(tenantId: string, dto: SendAudioRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      type: 'audio',
      audio: { link: dto.url },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.AUDIO, undefined, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: dto.to, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendVideo(tenantId: string, dto: SendVideoRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      type: 'video',
      video: { link: dto.url, caption: dto.caption },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.VIDEO, dto.caption, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: dto.to, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendDocument(tenantId: string, dto: SendDocumentRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      type: 'document',
      document: { link: dto.url, filename: dto.filename },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.DOCUMENT, dto.filename, dto.url);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: dto.to, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendReply(tenantId: string, dto: SendReplyRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      context: { message_id: dto.quotedMessageId },
      type: 'text',
      text: { body: dto.text },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.TEXT, dto.text, undefined, dto.quotedMessageId);
    this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: dto.to, messageId, status: 'SENT' });
    return { messageId };
  }

  async sendReaction(tenantId: string, dto: SendReactionRequest): Promise<{ messageId: string }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    const messageId = await this.graphPost(phoneNumberId, accessToken, {
      messaging_product: 'whatsapp',
      to: dto.to,
      type: 'reaction',
      reaction: { message_id: dto.messageId, emoji: dto.emoji },
    });
    await this.saveOutbound(tenantId, dto.to, messageId, MessageType.REACTION, dto.emoji);
    return { messageId };
  }

  async sendBulk(tenantId: string, dto: SendBulkRequest): Promise<{ sent: number; failed: number }> {
    const { phoneNumberId, accessToken } = await this.credentialsService.findByTenant(tenantId);
    let sent = 0;
    let failed = 0;

    for (const item of dto.messages) {
      try {
        const messageId = await this.graphPost(phoneNumberId, accessToken, {
          messaging_product: 'whatsapp',
          to: item.to,
          type: 'text',
          text: { body: item.text },
        });
        await this.saveOutbound(tenantId, item.to, messageId, MessageType.TEXT, item.text);
        this.gateway.emitToTenant(tenantId, 'message:sent', { tenantId, to: item.to, messageId, status: 'SENT' });
        sent++;
      } catch (err) {
        this.logger.warn(`messaging.bulk_send_failed to=${item.to} error=${err.message}`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    return { sent, failed };
  }

  async getHistory(
    tenantId: string,
    contactPhone: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: MessageHistoryEntity[]; total: number; page: number; limit: number; totalPages: number }> {
    const [items, total] = await this.messageRepo.findAndCount({
      where: { tenantId, contactPhone },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async saveAiOutbound(
    tenantId: string,
    to: string,
    content: string,
  ): Promise<void> {
    await this.messageRepo.save({
      tenantId,
      contactPhone: to,
      messageId: undefined,
      direction: MessageDirection.OUTBOUND,
      type: MessageType.TEXT,
      content,
      status: MessageStatus.SENT,
      aiProcessed: true,
    });
  }

  async saveInbound(
    tenantId: string,
    from: string,
    messageId: string,
    type: MessageType,
    content?: string,
    mediaUrl?: string,
    aiProcessed = false,
  ): Promise<void> {
    await this.messageRepo.save({
      tenantId,
      contactPhone: from,
      messageId,
      direction: MessageDirection.INBOUND,
      type,
      content,
      mediaUrl,
      status: MessageStatus.READ,
      aiProcessed,
    });
  }

  async updateMessageStatus(tenantId: string, messageId: string, status: MessageStatus): Promise<void> {
    await this.messageRepo.update({ tenantId, messageId }, { status });
  }

  async getConversationContext(
    tenantId: string,
    contactPhone: string,
    limit = 20,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.messageRepo.find({
      where: { tenantId, contactPhone },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return messages
      .reverse()
      .filter((m) => m.content)
      .map((m) => ({
        role: m.direction === MessageDirection.INBOUND ? 'user' : 'assistant',
        content: m.content,
      }));
  }
}
