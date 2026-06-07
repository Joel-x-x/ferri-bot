import { IsString, IsNotEmpty, IsOptional, IsUrl, Matches } from 'class-validator';

const toPhone = () =>
  Matches(/^\d{7,15}$/, {
    message: 'to must be a phone number in E.164 format without + (e.g. 521234567890)',
  });

export class SendImageRequest {
  @IsString() @IsNotEmpty() @toPhone() to: string;
  @IsUrl() url: string;
  @IsString() @IsOptional() caption?: string;
}

export class SendAudioRequest {
  @IsString() @IsNotEmpty() @toPhone() to: string;
  @IsUrl() url: string;
}

export class SendVideoRequest {
  @IsString() @IsNotEmpty() @toPhone() to: string;
  @IsUrl() url: string;
  @IsString() @IsOptional() caption?: string;
}

export class SendDocumentRequest {
  @IsString() @IsNotEmpty() @toPhone() to: string;
  @IsUrl() url: string;
  @IsString() @IsNotEmpty() filename: string;
}

export class SendReplyRequest {
  @IsString() @IsNotEmpty() @toPhone() to: string;
  @IsString() @IsNotEmpty() text: string;
  @IsString() @IsNotEmpty() quotedMessageId: string;
}

export class SendReactionRequest {
  @IsString() @IsNotEmpty() @toPhone() to: string;
  @IsString() @IsNotEmpty() messageId: string;
  @IsString() @IsNotEmpty() emoji: string;
}
