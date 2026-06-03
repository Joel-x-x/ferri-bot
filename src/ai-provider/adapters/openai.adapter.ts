import OpenAI from 'openai';
import { AiAdapter, AiMessage } from './ai-adapter.interface';

export class OpenAiAdapter implements AiAdapter {
  private client: OpenAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gpt-4o-mini',
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(messages: AiMessage[], systemPrompt?: string): Promise<string> {
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      openAiMessages.push({ role: 'system', content: systemPrompt });
    }

    openAiMessages.push(...messages.map((m) => ({ role: m.role, content: m.content })));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openAiMessages,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
