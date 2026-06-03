import { AiProviderEntityEntity, AiProviderEntityType } from '../database/entities/ai-provider.entity';
import { AiAdapter } from './adapters/ai-adapter.interface';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { OpenAiAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { CustomAdapter } from './adapters/custom.adapter';

export class AiProviderEntityFactory {
  static create(config: AiProviderEntity, decryptedApiKey: string): AiAdapter {
    switch (config.provider) {
      case AiProviderEntityType.GEMINI:
        return new GeminiAdapter(decryptedApiKey, config.model);
      case AiProviderEntityType.OPENAI:
        return new OpenAiAdapter(decryptedApiKey, config.model);
      case AiProviderEntityType.ANTHROPIC:
        return new AnthropicAdapter(decryptedApiKey, config.model);
      case AiProviderEntityType.CUSTOM:
        return new CustomAdapter(decryptedApiKey, config.baseUrl, config.model);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
}
