import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WAMessage, getContentType } from '@whiskeysockets/baileys';
import { MessagingService } from '../messaging/messaging.service';
import { WebhookService } from '../webhook/webhook.service';
import { WhatsappGateway } from '../gateway/whatsapp.gateway';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { MessageType } from '../../database/entities/message-history.entity';

interface MessageReceivedEvent {
  tenantId: string;
  message: WAMessage;
}

@Injectable()
export class IncomingService {
  private readonly logger = new Logger(IncomingService.name);
  private conversationHistory = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
  private readonly MAX_HISTORY = 20;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly webhookService: WebhookService,
    private readonly gateway: WhatsappGateway,
    private readonly aiProviderService: AiProviderService,
  ) {}

  @OnEvent('whatsapp.message.received')
  async handle(event: MessageReceivedEvent) {
    const { tenantId, message } = event;

    try {
      const jid = message.key.remoteJid;
      const messageId = message.key.id;
      const msgType = getContentType(message.message);

      const { type, content, mediaUrl } = this.extractContent(message);

      await this.messagingService.saveInbound(
        tenantId, jid, messageId, type, content, mediaUrl,
      );

      const payload = {
        tenantId,
        jid,
        from: jid,
        messageId,
        type,
        content,
        mediaUrl,
        timestamp: message.messageTimestamp,
      };

      this.gateway.emitToTenant(tenantId, 'message:received', payload);
      await this.webhookService.dispatch(tenantId, 'message.received', payload);
      await this.processAiReply(tenantId, jid, content);
    } catch (err) {
      this.logger.error(`Error handling incoming message for ${tenantId}: ${err.message}`);
    }
  }

  private extractContent(message: WAMessage): {
    type: MessageType;
    content?: string;
    mediaUrl?: string;
  } {
    const msg = message.message;
    if (!msg) return { type: MessageType.TEXT };

    if (msg.conversation || msg.extendedTextMessage) {
      return {
        type: MessageType.TEXT,
        content: msg.conversation || msg.extendedTextMessage?.text,
      };
    }
    if (msg.imageMessage) {
      return { type: MessageType.IMAGE, content: msg.imageMessage.caption };
    }
    if (msg.audioMessage) {
      return { type: MessageType.AUDIO };
    }
    if (msg.videoMessage) {
      return { type: MessageType.VIDEO, content: msg.videoMessage.caption };
    }
    if (msg.documentMessage) {
      return { type: MessageType.DOCUMENT, content: msg.documentMessage.fileName };
    }
    if (msg.stickerMessage) {
      return { type: MessageType.STICKER };
    }
    if (msg.reactionMessage) {
      return { type: MessageType.REACTION, content: msg.reactionMessage.text };
    }

    return { type: MessageType.TEXT };
  }

  private async processAiReply(tenantId: string, jid: string, content?: string) {
    if (!content) return;

    try {
      const config = await this.aiProviderService.getProvider(tenantId);
      if (!config?.isActive || !config?.autoReply) return;

      const historyKey = `${tenantId}:${jid}`;
      const history = this.conversationHistory.get(historyKey) ?? [];

      history.push({ role: 'user', content });
      if (history.length > this.MAX_HISTORY) history.shift();
      this.conversationHistory.set(historyKey, history);

      const aiResponse = await this.aiProviderService.chat(tenantId, history, config.systemPrompt);

      history.push({ role: 'assistant', content: aiResponse });
      if (history.length > this.MAX_HISTORY) history.shift();
      this.conversationHistory.set(historyKey, history);

      await this.messagingService.sendText(tenantId, { to: jid, text: aiResponse });
      await this.messagingService.saveInbound(tenantId, jid, '', MessageType.TEXT, aiResponse, undefined, true);
    } catch (err) {
      this.logger.warn(`AI reply failed for ${tenantId}:${jid}: ${err.message}`);
    }
  }
}
