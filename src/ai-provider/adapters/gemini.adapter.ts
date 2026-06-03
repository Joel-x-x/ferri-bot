import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException } from '@nestjs/common';
import { AiAdapter, AiMessage } from './ai-adapter.interface';

export class GeminiAdapter implements AiAdapter {
  private client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gemini-1.5-flash',
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(messages: AiMessage[], systemPrompt?: string): Promise<string> {
    if (!messages.length) throw new BadRequestException('Messages array cannot be empty');

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
    });

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = genModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }
}
