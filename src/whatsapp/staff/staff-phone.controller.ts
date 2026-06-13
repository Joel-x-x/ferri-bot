import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffPhoneService } from './staff-phone.service';
import { CreateStaffPhoneRequest, UpdateStaffPhoneRequest } from './dto/staff-phone.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';

@Controller('whatsapp/staff')
@UseGuards(JwtAuthGuard)
export class StaffPhoneController {
  constructor(private readonly service: StaffPhoneService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  add(@CurrentTenant() tenantId: string, @Body() dto: CreateStaffPhoneRequest) {
    return this.service.add(tenantId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateStaffPhoneRequest,
  ) {
    return this.service.update(id, tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
