import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaginationQuery } from '../../shared/dto/pagination.query';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
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

@ApiTags('messages')
@ApiBearerAuth('JWT')
@Controller('whatsapp/messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('text')
  @HttpCode(HttpStatus.OK)
  sendText(@CurrentTenant() tenantId: string, @Body() dto: SendTextRequest) {
    return this.messagingService.sendText(tenantId, dto);
  }

  @Post('image')
  @HttpCode(HttpStatus.OK)
  sendImage(@CurrentTenant() tenantId: string, @Body() dto: SendImageRequest) {
    return this.messagingService.sendImage(tenantId, dto);
  }

  @Post('audio')
  @HttpCode(HttpStatus.OK)
  sendAudio(@CurrentTenant() tenantId: string, @Body() dto: SendAudioRequest) {
    return this.messagingService.sendAudio(tenantId, dto);
  }

  @Post('video')
  @HttpCode(HttpStatus.OK)
  sendVideo(@CurrentTenant() tenantId: string, @Body() dto: SendVideoRequest) {
    return this.messagingService.sendVideo(tenantId, dto);
  }

  @Post('document')
  @HttpCode(HttpStatus.OK)
  sendDocument(@CurrentTenant() tenantId: string, @Body() dto: SendDocumentRequest) {
    return this.messagingService.sendDocument(tenantId, dto);
  }

  @Post('reply')
  @HttpCode(HttpStatus.OK)
  sendReply(@CurrentTenant() tenantId: string, @Body() dto: SendReplyRequest) {
    return this.messagingService.sendReply(tenantId, dto);
  }

  @Post('reaction')
  @HttpCode(HttpStatus.OK)
  sendReaction(@CurrentTenant() tenantId: string, @Body() dto: SendReactionRequest) {
    return this.messagingService.sendReaction(tenantId, dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  sendBulk(@CurrentTenant() tenantId: string, @Body() dto: SendBulkRequest) {
    return this.messagingService.sendBulk(tenantId, dto);
  }

  @Get('history/:phone')
  getHistory(
    @CurrentTenant() tenantId: string,
    @Param('phone') phone: string,
    @Query() query: PaginationQuery,
  ) {
    return this.messagingService.getHistory(tenantId, phone, query.page, query.limit);
  }
}
