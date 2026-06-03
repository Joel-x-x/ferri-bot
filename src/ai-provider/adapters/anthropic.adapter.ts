import Anthropic from '@anthropic-ai/sdk';
import { AiAdapter, AiMessage } from './ai-adapter.interface';

export class AnthropicAdapter implements AiAdapter {
  private client: Anthropic;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'claude-haiku-4-5-20251001',
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: AiMessage[], systemPrompt?: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
