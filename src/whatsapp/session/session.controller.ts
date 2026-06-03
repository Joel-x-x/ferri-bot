import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';

@ApiTags('sessions')
@ApiBearerAuth('JWT')
@Controller('whatsapp/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentTenant() tenantId: string) {
    return this.sessionService.startSession(tenantId);
  }

  @Get('status')
  getStatus(@CurrentTenant() tenantId: string) {
    return this.sessionService.getStatus(tenantId);
  }

  @Post('reconnect')
  @HttpCode(HttpStatus.OK)
  reconnect(@CurrentTenant() tenantId: string) {
    return this.sessionService.reconnect(tenantId);
  }

  @Delete('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentTenant() tenantId: string) {
    return this.sessionService.logout(tenantId);
  }
}
