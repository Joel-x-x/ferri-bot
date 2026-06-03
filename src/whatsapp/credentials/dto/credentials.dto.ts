import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateCredentialsDto {
  @IsString() @IsNotEmpty() phoneNumberId: string;
  @IsString() @IsNotEmpty() accessToken: string;
  @IsString() @IsNotEmpty() wabaId: string;
  @IsString() @IsNotEmpty() verifyToken: string;
  @IsString() @IsOptional() displayName?: string;
}

export class UpdateCredentialsDto {
  @IsString() @IsOptional() accessToken?: string;
  @IsString() @IsOptional() verifyToken?: string;
  @IsString() @IsOptional() displayName?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
