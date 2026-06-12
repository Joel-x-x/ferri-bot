import { Injectable, Logger } from '@nestjs/common';
import { MessagingService } from '../messaging/messaging.service';
import { WebhookService } from '../webhook/webhook.service';
import { WhatsappGateway } from '../gateway/whatsapp.gateway';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { CredentialsService } from '../credentials/credentials.service';
import { MessageType, MessageStatus } from '../../database/entities/message-history.entity';

const WELCOME_MESSAGE = `¡Hola! 👋 Soy *FerriBot*, tu asistente virtual.

Puedo ayudarte con:
*1.* Consultar precios y disponibilidad
*2.* Hacer una cotización
*3.* Hablar con un asesor

¿En qué te ayudo?`;

@Injectable()
export class IncomingService {
  private readonly logger = new Logger(IncomingService.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly webhookService: WebhookService,
    private readonly gateway: WhatsappGateway,
    private readonly aiProviderService: AiProviderService,
    private readonly credentialsService: CredentialsService,
  ) {}

  async verifyToken(verifyToken: string): Promise<boolean> {
    const creds = await this.credentialsService.findByVerifyToken(verifyToken).catch(() => null);
    if (creds) this.logger.log('meta.webhook_verified');
    return !!creds;
  }

  async handlePayload(payload: any): Promise<void> {
    if (payload?.object !== 'whatsapp_business_account') return;

    try {
      for (const entry of payload?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
          if (change?.field !== 'messages') continue;
          const value = change?.value;
          const phoneNumberId: string = value?.metadata?.phone_number_id;
          if (!phoneNumberId) continue;

          const creds = await this.credentialsService.findByPhoneNumberId(phoneNumberId);
          if (!creds) {
            this.logger.warn(`meta.unknown_phone_number_id phoneNumberId=${phoneNumberId}`);
            continue;
          }

          const { tenantId } = creds;

          for (const msg of value?.messages ?? []) {
            await this.handleMessage(tenantId, creds.salesPhone, msg).catch((err) =>
              this.logger.error(`meta.message_handling_failed tenant=${tenantId} error=${err.message}`),
            );
          }

          for (const status of value?.statuses ?? []) {
            await this.handleStatus(tenantId, status).catch((err) =>
              this.logger.error(`meta.status_handling_failed tenant=${tenantId} error=${err.message}`),
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(`meta.webhook_process_failed error=${err.message}`);
    }
  }

  private async handleMessage(tenantId: string, salesPhone: string | null, msg: any): Promise<void> {
    const from: string = msg.from;
    const messageId: string = msg.id;
    const { type, content, mediaUrl } = this.extractContent(msg);

    await this.messagingService.saveInbound(tenantId, from, messageId, type, content, mediaUrl);

    const payload = { tenantId, from, messageId, type, content, mediaUrl, timestamp: msg.timestamp };
    this.gateway.emitToTenant(tenantId, 'message:received', payload);
    await this.webhookService.dispatch(tenantId, 'message.received', payload);
    await this.processAiReply(tenantId, from, salesPhone, content);
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

  private async processAiReply(tenantId: string, from: string, salesPhone: string | null, content?: string): Promise<void> {
    if (!content) return;

    try {
      const isFirst = await this.messagingService.isFirstContact(tenantId, from);
      if (isFirst) {
        await this.messagingService.sendText(tenantId, { to: from, text: WELCOME_MESSAGE });
        await this.messagingService.saveAiOutbound(tenantId, from, WELCOME_MESSAGE);
        this.logger.log(`ferribot.welcome_sent tenant=${tenantId} to=${from}`);
        return; // welcome IS the response for first contact
      }

      const history = await this.messagingService.getConversationContext(tenantId, from);
      const aiResult = await this.aiProviderService.chatIfAutoReply(tenantId, history, from);
      if (!aiResult) return;

      await this.messagingService.sendText(tenantId, { to: from, text: aiResult.text });
      if (aiResult.imageUrl) {
        await this.messagingService.sendImage(tenantId, { to: from, url: aiResult.imageUrl });
      }
      if (aiResult.vendorNotification && salesPhone) {
        const { items, total, clientPhone } = aiResult.vendorNotification;
        const vendorMsg = this.buildVendorMessage(clientPhone, items, total);
        await this.messagingService.sendText(tenantId, { to: salesPhone, text: vendorMsg });
        this.logger.log(`ferribot.quotation_sent tenant=${tenantId} client=${from} vendor=${salesPhone}`);
      }
      await this.messagingService.saveAiOutbound(tenantId, from, aiResult.text);
    } catch (err) {
      this.logger.warn(`ai.reply_failed tenant=${tenantId} from=${from} error=${err.message}`);
    }
  }

  private buildVendorMessage(clientPhone: string, items: string, total: string): string {
    const now = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
    return `🔔 *Nueva cotización vía FerriBot*\n\nCliente: ${clientPhone}\n\nProductos:\n${items}\n\n*Total estimado: ${total}*\n\n_${now}_`;
  }
}
