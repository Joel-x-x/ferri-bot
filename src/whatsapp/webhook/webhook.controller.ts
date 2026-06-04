import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CreateWebhookRequest, UpdateWebhookRequest } from './dto/webhook.dto';

@ApiTags('webhooks')
@ApiBearerAuth('JWT')
@Controller('whatsapp/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateWebhookRequest) {
    return this.webhookService.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.webhookService.findAll(tenantId);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookRequest,
  ) {
    return this.webhookService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.webhookService.remove(tenantId, id);
  }
}
