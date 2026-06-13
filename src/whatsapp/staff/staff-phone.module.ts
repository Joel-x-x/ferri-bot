import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffPhoneEntity } from '../../database/entities/staff-phone.entity';
import { StaffPhoneService } from './staff-phone.service';
import { StaffPhoneController } from './staff-phone.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StaffPhoneEntity])],
  providers: [StaffPhoneService],
  controllers: [StaffPhoneController],
  exports: [StaffPhoneService],
})
export class StaffPhoneModule {}
