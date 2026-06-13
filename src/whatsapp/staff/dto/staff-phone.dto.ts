import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateStaffPhoneRequest {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsOptional() name?: string;
}

export class UpdateStaffPhoneRequest {
  @IsString() @IsOptional() name?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
