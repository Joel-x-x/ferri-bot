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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { SendTextDto } from './dto/send-text.dto';
import {
  SendImageDto,
  SendAudioDto,
  SendVideoDto,
  SendDocumentDto,
  SendReplyDto,
  SendReactionDto,
} from './dto/send-media.dto';
import { SendBulkDto } from './dto/send-bulk.dto';

@ApiTags('messages')
@ApiBearerAuth('JWT')
@Controller('whatsapp/messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('text')
  @HttpCode(HttpStatus.OK)
  sendText(@CurrentTenant() tenantId: string, @Body() dto: SendTextDto) {
    return this.messagingService.sendText(tenantId, dto);
  }

  @Post('image')
  @HttpCode(HttpStatus.OK)
  sendImage(@CurrentTenant() tenantId: string, @Body() dto: SendImageDto) {
    return this.messagingService.sendImage(tenantId, dto);
  }

  @Post('audio')
  @HttpCode(HttpStatus.OK)
  sendAudio(@CurrentTenant() tenantId: string, @Body() dto: SendAudioDto) {
    return this.messagingService.sendAudio(tenantId, dto);
  }

  @Post('video')
  @HttpCode(HttpStatus.OK)
  sendVideo(@CurrentTenant() tenantId: string, @Body() dto: SendVideoDto) {
    return this.messagingService.sendVideo(tenantId, dto);
  }

  @Post('document')
  @HttpCode(HttpStatus.OK)
  sendDocument(@CurrentTenant() tenantId: string, @Body() dto: SendDocumentDto) {
    return this.messagingService.sendDocument(tenantId, dto);
  }

  @Post('reply')
  @HttpCode(HttpStatus.OK)
  sendReply(@CurrentTenant() tenantId: string, @Body() dto: SendReplyDto) {
    return this.messagingService.sendReply(tenantId, dto);
  }

  @Post('reaction')
  @HttpCode(HttpStatus.OK)
  sendReaction(@CurrentTenant() tenantId: string, @Body() dto: SendReactionDto) {
    return this.messagingService.sendReaction(tenantId, dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  sendBulk(@CurrentTenant() tenantId: string, @Body() dto: SendBulkDto) {
    return this.messagingService.sendBulk(tenantId, dto);
  }

  @Get('history/:jid')
  getHistory(
    @CurrentTenant() tenantId: string,
    @Param('jid') jid: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.messagingService.getHistory(tenantId, jid, +page, +limit);
  }
}
