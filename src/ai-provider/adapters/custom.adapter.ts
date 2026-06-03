import axios from 'axios';
import { AiAdapter, AiMessage } from './ai-adapter.interface';

export class CustomAdapter implements AiAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async chat(messages: AiMessage[], systemPrompt?: string): Promise<string> {
    const response = await axios.post(
      `${this.baseUrl}/chat`,
      { messages, systemPrompt, model: this.model },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
    );

    return response.data?.content ?? response.data?.message ?? String(response.data);
  }
}
