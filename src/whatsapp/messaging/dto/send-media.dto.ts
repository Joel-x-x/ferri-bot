import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class SendImageDto {
  @IsString() @IsNotEmpty() to: string;
  @IsUrl() url: string;
  @IsString() @IsOptional() caption?: string;
}

export class SendAudioDto {
  @IsString() @IsNotEmpty() to: string;
  @IsUrl() url: string;
  @IsOptional() ptt?: boolean;
}

export class SendVideoDto {
  @IsString() @IsNotEmpty() to: string;
  @IsUrl() url: string;
  @IsString() @IsOptional() caption?: string;
}

export class SendDocumentDto {
  @IsString() @IsNotEmpty() to: string;
  @IsUrl() url: string;
  @IsString() @IsNotEmpty() filename: string;
  @IsString() @IsNotEmpty() mimetype: string;
}

export class SendReplyDto {
  @IsString() @IsNotEmpty() to: string;
  @IsString() @IsNotEmpty() text: string;
  @IsString() @IsNotEmpty() quotedMessageId: string;
}

export class SendReactionDto {
  @IsString() @IsNotEmpty() to: string;
  @IsString() @IsNotEmpty() messageId: string;
  @IsString() @IsNotEmpty() emoji: string;
}
