import { Injectable, Logger } from '@nestjs/common';
import { MessagingService } from '../messaging/messaging.service';
import { WebhookService } from '../webhook/webhook.service';
import { WhatsappGateway } from '../gateway/whatsapp.gateway';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { CredentialsService } from '../credentials/credentials.service';
import { MessageType, MessageStatus } from '../../database/entities/message-history.entity';

@Injectable()
export class IncomingService {
  private readonly logger = new Logger(IncomingService.name);
  private conversationHistory = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
  private readonly MAX_HISTORY = 20;
  private readonly MAX_CONVERSATIONS = 500;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly webhookService: WebhookService,
    private readonly gateway: WhatsappGateway,
    private readonly aiProviderService: AiProviderService,
    private readonly credentialsService: CredentialsService,
  ) {}

  async verifyToken(verifyToken: string): Promise<boolean> {
    const creds = await this.credentialsService.findByVerifyToken(verifyToken).catch(() => null);
    return !!creds;
  }

  async handlePayload(payload: any): Promise<void> {
    if (payload?.object !== 'whatsapp_business_account') return;

    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== 'messages') continue;
        const value = change?.value;
        const phoneNumberId: string = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const creds = await this.credentialsService.findByPhoneNumberId(phoneNumberId);
        if (!creds) {
          this.logger.warn(`No tenant for phone_number_id ${phoneNumberId}`);
          continue;
        }

        const { tenantId } = creds;

        for (const msg of value?.messages ?? []) {
          await this.handleMessage(tenantId, msg).catch((err) =>
            this.logger.error(`Message handling failed for ${tenantId}: ${err.message}`),
          );
        }

        for (const status of value?.statuses ?? []) {
          await this.handleStatus(tenantId, status).catch((err) =>
            this.logger.error(`Status handling failed for ${tenantId}: ${err.message}`),
          );
        }
      }
    }
  }

  private async handleMessage(tenantId: string, msg: any): Promise<void> {
    const from: string = msg.from;
    const messageId: string = msg.id;
    const { type, content, mediaUrl } = this.extractContent(msg);

    await this.messagingService.saveInbound(tenantId, from, messageId, type, content, mediaUrl);

    const payload = { tenantId, from, messageId, type, content, mediaUrl, timestamp: msg.timestamp };
    this.gateway.emitToTenant(tenantId, 'message:received', payload);
    await this.webhookService.dispatch(tenantId, 'message.received', payload);
    await this.processAiReply(tenantId, from, content);
  }

  private async handleStatus(tenantId: string, status: any): Promise<void> {
    const messageId: string = status.id;
    const rawStatus: string = status.status; // sent | delivered | read | failed

    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    const mapped = statusMap[rawStatus];
    if (mapped) {
      await this.messagingService.updateMessageStatus(tenantId, messageId, mapped);
    }

    this.gateway.emitToTenant(tenantId, 'message:status', { tenantId, messageId, status: rawStatus });
    await this.webhookService.dispatch(tenantId, 'message.status', { tenantId, messageId, status: rawStatus });
  }

  private extractContent(msg: any): { type: MessageType; content?: string; mediaUrl?: string } {
    switch (msg.type) {
      case 'text':
        return { type: MessageType.TEXT, content: msg.text?.body };
      case 'image':
        return { type: MessageType.IMAGE, content: msg.image?.caption, mediaUrl: msg.image?.id };
      case 'audio':
        return { type: MessageType.AUDIO, mediaUrl: msg.audio?.id };
      case 'video':
        return { type: MessageType.VIDEO, content: msg.video?.caption, mediaUrl: msg.video?.id };
      case 'document':
        return { type: MessageType.DOCUMENT, content: msg.document?.filename, mediaUrl: msg.document?.id };
      case 'sticker':
        return { type: MessageType.STICKER };
      case 'reaction':
        return { type: MessageType.REACTION, content: msg.reaction?.emoji };
      default:
        return { type: MessageType.TEXT };
    }
  }

  private async processAiReply(tenantId: string, from: string, content?: string): Promise<void> {
    if (!content) return;

    try {
      const historyKey = `${tenantId}:${from}`;
      const history = this.conversationHistory.get(historyKey) ?? [];

      // Evict oldest conversation if map is at capacity
      if (!this.conversationHistory.has(historyKey) && this.conversationHistory.size >= this.MAX_CONVERSATIONS) {
        const oldestKey = this.conversationHistory.keys().next().value;
        this.conversationHistory.delete(oldestKey);
      }

      history.push({ role: 'user', content });
      if (history.length > this.MAX_HISTORY) history.shift();
      this.conversationHistory.set(historyKey, history);

      // Single DB query: checks isActive + autoReply, returns null if disabled
      const aiResponse = await this.aiProviderService.chatIfAutoReply(tenantId, history);
      if (!aiResponse) return;

      history.push({ role: 'assistant', content: aiResponse });
      if (history.length > this.MAX_HISTORY) history.shift();
      this.conversationHistory.set(historyKey, history);

      await this.messagingService.sendText(tenantId, { to: from, text: aiResponse });
      await this.messagingService.saveAiOutbound(tenantId, from, aiResponse);
    } catch (err) {
      this.logger.warn(`ai.reply_failed tenant=${tenantId} from=${from} error=${err.message}`);
    }
  }
}
