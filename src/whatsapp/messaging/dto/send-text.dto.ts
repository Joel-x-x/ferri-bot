import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SendTextDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(@s\.whatsapp\.net|@g\.us)?$/, {
    message: 'to must be a valid JID or phone number (e.g. 521234567890 or 521234567890@s.whatsapp.net)',
  })
  to: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}
