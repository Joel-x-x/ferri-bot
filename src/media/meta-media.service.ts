import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { envs } from '../config/envs';

const GRAPH_URL = `https://graph.facebook.com/${envs.meta.apiVersion}`;

@Injectable()
export class MetaMediaService {
  private readonly logger = new Logger(MetaMediaService.name);

  /**
   * Downloads media from Meta Cloud API.
   * Step 1: GET /{mediaId} → returns download URL
   * Step 2: GET download URL → returns binary data as Buffer
   */
  async downloadMedia(mediaId: string, accessToken: string): Promise<{ buffer: Buffer; mimeType: string }> {
    // Step 1: Get media URL
    const { data: mediaInfo } = await axios.get(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10_000,
    });

    const downloadUrl: string = mediaInfo.url;
    const mimeType: string = mediaInfo.mime_type ?? 'application/octet-stream';

    // Step 2: Download binary
    const { data: buffer } = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
      timeout: 30_000,
    });

    this.logger.log(`meta.media_downloaded mediaId=${mediaId} mimeType=${mimeType} size=${buffer.byteLength}`);
    return { buffer: Buffer.from(buffer), mimeType };
  }
}
