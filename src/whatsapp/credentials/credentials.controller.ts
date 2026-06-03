import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CredentialsService } from './credentials.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CreateCredentialsDto, UpdateCredentialsDto } from './dto/credentials.dto';

@ApiTags('credentials')
@ApiBearerAuth('JWT')
@Controller('whatsapp/credentials')
@UseGuards(JwtAuthGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateCredentialsDto) {
    return this.credentialsService.create(tenantId, dto);
  }

  @Get()
  findOne(@CurrentTenant() tenantId: string) {
    return this.credentialsService.findByTenantSafe(tenantId);
  }

  @Patch()
  update(@CurrentTenant() tenantId: string, @Body() dto: UpdateCredentialsDto) {
    return this.credentialsService.update(tenantId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() tenantId: string) {
    return this.credentialsService.remove(tenantId);
  }
}
