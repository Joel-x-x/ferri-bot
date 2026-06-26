import { Module } from '@nestjs/common';
import { MetaMediaService } from './meta-media.service';
import { SttService } from './stt.service';

@Module({
  providers: [MetaMediaService, SttService],
  exports: [MetaMediaService, SttService],
})
export class MediaModule {}
