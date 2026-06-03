import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import axios from 'axios';
import { WebhookSubscription } from '../../database/entities/webhook-subscription.entity';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly webhookRepo: Repository<WebhookSubscription>,
  ) {}

  async create(tenantId: string, dto: CreateWebhookDto): Promise<WebhookSubscription> {
    return this.webhookRepo.save({ ...dto, tenantId });
  }

  async findAll(tenantId: string): Promise<WebhookSubscription[]> {
    return this.webhookRepo.find({ where: { tenantId } });
  }

  async update(tenantId: string, id: string, dto: UpdateWebhookDto): Promise<WebhookSubscription> {
    const webhook = await this.webhookRepo.findOne({ where: { id, tenantId } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    Object.assign(webhook, dto);
    return this.webhookRepo.save(webhook);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const webhook = await this.webhookRepo.findOne({ where: { id, tenantId } });
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    await this.webhookRepo.remove(webhook);
  }

  async dispatch(tenantId: string, event: string, payload: any): Promise<void> {
    const webhooks = await this.webhookRepo.find({
      where: { tenantId, isActive: true },
    });

    const matching = webhooks.filter(
      (w) => w.events.includes(event) || w.events.includes('*'),
    );

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.allSettled(
      matching.map((webhook) => this.send(webhook, body)),
    );
  }

  private async send(webhook: WebhookSubscription, body: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Ferri-Event': 'whatsapp',
    };

    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');
      headers['X-Ferri-Signature'] = `sha256=${signature}`;
    }

    try {
      await axios.post(webhook.url, body, { headers, timeout: 10_000 });
    } catch (err) {
      this.logger.warn(`Webhook delivery failed to ${webhook.url}: ${err.message}`);
    }
  }
}
