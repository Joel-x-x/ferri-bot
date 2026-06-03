import { IsUrl, IsArray, IsString, IsOptional, IsBoolean, ArrayNotEmpty } from 'class-validator';
import { WEBHOOK_EVENTS, WebhookEvent } from '../../../database/entities/webhook-subscription.entity';

export class CreateWebhookRequest {
  @IsUrl()
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: WebhookEvent[];

  @IsString()
  @IsOptional()
  secret?: string;
}

export class UpdateWebhookRequest {
  @IsUrl()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: WebhookEvent[];

  @IsString()
  @IsOptional()
  secret?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
