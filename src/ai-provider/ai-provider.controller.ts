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
import { AiProviderService } from './ai-provider.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../shared/decorators/current-tenant.decorator';
import { UpsertAiProviderRequest, UpdateAiProviderRequest, TestAiRequest } from './dto/ai-provider.dto';

@ApiTags('ai')
@ApiBearerAuth('JWT')
@Controller('whatsapp/ai')
@UseGuards(JwtAuthGuard)
export class AiProviderController {
  constructor(private readonly aiProviderService: AiProviderService) {}

  @Post('provider')
  @HttpCode(HttpStatus.CREATED)
  upsert(@CurrentTenant() tenantId: string, @Body() dto: UpsertAiProviderRequest) {
    return this.aiProviderService.upsert(tenantId, dto);
  }

  @Get('provider')
  getProvider(@CurrentTenant() tenantId: string) {
    return this.aiProviderService.getProviderSafe(tenantId);
  }

  @Patch('provider')
  update(@CurrentTenant() tenantId: string, @Body() dto: UpdateAiProviderRequest) {
    return this.aiProviderService.update(tenantId, dto);
  }

  @Delete('provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() tenantId: string) {
    return this.aiProviderService.remove(tenantId);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async test(@CurrentTenant() tenantId: string, @Body() dto: TestAiRequest) {
    const response = await this.aiProviderService.chat(
      tenantId,
      [{ role: 'user', content: dto.message }],
    );
    return { response };
  }
}
