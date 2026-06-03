import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsUrl,
} from 'class-validator';
import { AiProviderType } from '../../database/entities/ai-provider.entity';

export class UpsertAiProviderDto {
  @IsEnum(AiProviderType)
  provider: AiProviderType;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsUrl()
  @IsOptional()
  baseUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  autoReply?: boolean;
}

export class UpdateAiProviderDto {
  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsUrl()
  @IsOptional()
  baseUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  autoReply?: boolean;
}

export class TestAiDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
