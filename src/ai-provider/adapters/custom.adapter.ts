import axios, { AxiosError } from 'axios';
import { BadRequestException } from '@nestjs/common';
import { AiAdapter, AiChatResult, AiMessage, AiTool, AiToolExecutor } from './ai-adapter.interface';

export class CustomAdapter implements AiAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async chat(
    messages: AiMessage[],
    systemPrompt?: string,
    _tools?: AiTool[],
    _toolExecutor?: AiToolExecutor,
  ): Promise<AiChatResult> {
    try {
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
      const text = response.data?.content ?? response.data?.message ?? String(response.data);
      return { text };
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const detail = axiosErr.response?.data?.error ?? axiosErr.response?.data?.message ?? axiosErr.message;
      throw new BadRequestException(`Custom AI provider error: ${detail}`);
    }
  }
}
