import { AiProvider, AiProviderType } from '../database/entities/ai-provider.entity';
import { AiAdapter } from './adapters/ai-adapter.interface';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { CustomAdapter } from './adapters/custom.adapter';

export class AiProviderFactory {
  static create(config: AiProvider, decryptedApiKey: string): AiAdapter {
    switch (config.provider) {
      case AiProviderType.GEMINI:
        return new GeminiAdapter(decryptedApiKey, config.model);
      case AiProviderType.OPENAI:
        return new OpenAiAdapter(decryptedApiKey, config.model);
      case AiProviderType.ANTHROPIC:
        return new AnthropicAdapter(decryptedApiKey, config.model);
      case AiProviderType.CUSTOM:
        return new CustomAdapter(decryptedApiKey, config.baseUrl, config.model);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
}
