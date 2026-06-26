import { Injectable, Logger } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { envs } from '../config/envs';

const PROVIDERS: Record<string, { baseURL: string; envKey: string }> = {
  groq: { baseURL: 'https://api.groq.com/openai/v1', envKey: 'GROQ_API_KEY' },
  openai: { baseURL: 'https://api.openai.com/v1', envKey: 'OPENAI_API_KEY' },
};

const MODELS: Record<string, string> = {
  groq: 'whisper-large-v3',
  openai: 'whisper-1',
};

const MAX_AUDIO_DURATION_SECONDS = 1800; // 30 min default
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (Whisper limit)

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    provider = envs.stt?.provider ?? 'groq',
    fallbackProvider = envs.stt?.fallbackProvider ?? 'openai',
  ): Promise<string | null> {
    if (audioBuffer.byteLength > MAX_AUDIO_SIZE_BYTES) {
      this.logger.warn(`stt.audio_too_large size=${audioBuffer.byteLength}`);
      return null;
    }

    try {
      return await this.callProvider(audioBuffer, mimeType, provider);
    } catch (err) {
      this.logger.warn(`stt.primary_failed provider=${provider} error=${err.message}`);

      if (fallbackProvider && fallbackProvider !== provider) {
        try {
          return await this.callProvider(audioBuffer, mimeType, fallbackProvider);
        } catch (fallbackErr) {
          this.logger.error(`stt.fallback_failed provider=${fallbackProvider} error=${fallbackErr.message}`);
        }
      }

      return null;
    }
  }

  private async callProvider(audioBuffer: Buffer, mimeType: string, provider: string): Promise<string> {
    const config = PROVIDERS[provider];
    if (!config) throw new Error(`Unknown STT provider: ${provider}`);

    const apiKey = process.env[config.envKey];
    if (!apiKey) throw new Error(`Missing env var: ${config.envKey}`);

    const client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
    });

    const extension = this.mimeToExtension(mimeType);
    const file = await toFile(audioBuffer, `audio.${extension}`, { type: mimeType });

    const response = await client.audio.transcriptions.create({
      file,
      model: MODELS[provider] ?? 'whisper-large-v3',
      language: 'es',
    });

    this.logger.log(`stt.transcribed provider=${provider} chars=${response.text.length}`);
    return response.text;
  }

  private mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
    };
    return map[mimeType] ?? 'ogg';
  }
}
