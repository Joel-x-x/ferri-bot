import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { IncomingService } from './incoming.service';

@ApiTags('meta-webhook')
@Controller('whatsapp/meta/webhook')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(private readonly incomingService: IncomingService) {}

  /**
   * GET — Meta webhook verification challenge.
   * Meta sends hub.mode, hub.verify_token, hub.challenge.
   * We look up the tenant by verify_token and respond with the challenge.
   */
  @Get()
  @ApiOperation({ summary: 'Meta webhook verification' })
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe') {
      const valid = await this.incomingService.verifyToken(verifyToken);
      if (valid) {
        this.logger.log(`Webhook verified for token ${verifyToken}`);
        return res.status(200).send(challenge);
      }
    }
    return res.status(403).send('Forbidden');
  }

  /**
   * POST — Receive messages and status updates from Meta.
   * Payload is routed by phone_number_id → tenant.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Meta webhook events' })
  async receive(@Body() payload: any) {
    // Always respond 200 immediately to Meta
    this.incomingService.handlePayload(payload).catch((err) =>
      this.logger.error(`Error processing Meta webhook: ${err.message}`),
    );
    return { status: 'ok' };
  }
}
