import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested, ArrayMaxSize, Matches } from 'class-validator';

class BulkItem {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,15}$/, {
    message: 'to must be a phone number in E.164 format without + (e.g. 521234567890)',
  })
  to: string;

  @IsString() @IsNotEmpty() text: string;
}

export class SendBulkRequest {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkItem)
  messages: BulkItem[];
}
