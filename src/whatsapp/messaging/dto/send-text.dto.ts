import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SendTextDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,15}$/, {
    message: 'to must be a phone number in E.164 format without + (e.g. 521234567890)',
  })
  to: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}
