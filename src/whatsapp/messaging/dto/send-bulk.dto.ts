import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested, ArrayMaxSize } from 'class-validator';

class BulkItem {
  @IsString() @IsNotEmpty() to: string;
  @IsString() @IsNotEmpty() text: string;
}

export class SendBulkDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkItem)
  messages: BulkItem[];
}
