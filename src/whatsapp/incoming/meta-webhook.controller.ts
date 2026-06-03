import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { IncomingService } from './incoming.service';

@ApiTags('meta-webhook')
@Controller('whatsapp/meta/webhook')
export class MetaWebhookController {
  constructor(private readonly incomingService: IncomingService) {}

  /**
   * GET — Meta webhook verification challenge.
   * Meta sends hub.mode, hub.verify_token, hub.challenge.
   */
  @Get()
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe') {
      const valid = await this.incomingService.verifyToken(verifyToken);
      if (valid) return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  /**
   * POST — Receive messages and status updates from Meta.
   * Always responds 200 immediately; processing is fire-and-forget.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() payload: any) {
    void this.incomingService.handlePayload(payload);
    return { status: 'ok' };
  }
}
