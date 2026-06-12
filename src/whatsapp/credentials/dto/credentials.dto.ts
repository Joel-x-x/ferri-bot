import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { MetaCredentialsEntity } from '../../../database/entities/meta-credentials.entity';

export class CreateCredentialsRequest {
  @IsString() @IsNotEmpty() phoneNumberId: string;
  @IsString() @IsNotEmpty() accessToken: string;
  @IsString() @IsNotEmpty() wabaId: string;
  @IsString() @IsNotEmpty() verifyToken: string;
  @IsString() @IsOptional() displayName?: string;
}

export class UpdateCredentialsRequest {
  @IsString() @IsOptional() accessToken?: string;
  @IsString() @IsOptional() verifyToken?: string;
  @IsString() @IsOptional() displayName?: string;
  @IsString() @IsOptional() salesPhone?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

export type CredentialsResponse = Omit<MetaCredentialsEntity, 'accessToken'>;
