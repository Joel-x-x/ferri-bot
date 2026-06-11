import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { BadRequestException } from '@nestjs/common';
import { AiAdapter, AiChatResult, AiMessage, AiTool, AiToolExecutor } from './ai-adapter.interface';

const MAX_TOOL_ROUNDS = 5;

export class GeminiAdapter implements AiAdapter {
  private client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gemini-2.0-flash',
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(
    messages: AiMessage[],
    systemPrompt?: string,
    tools?: AiTool[],
    toolExecutor?: AiToolExecutor,
  ): Promise<AiChatResult> {
    if (!messages.length) throw new BadRequestException('Messages array cannot be empty');

    const functionDeclarations = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as any,
    }));

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      tools: functionDeclarations?.length ? [{ functionDeclarations }] : undefined,
    });

    const history: Content[] = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = genModel.startChat({ history });
    let imageUrl: string | undefined;

    // Initial user message
    let nextMessage: string | Part[] = messages[messages.length - 1].content;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await chat.sendMessage(nextMessage);
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (!functionCalls?.length || !toolExecutor) {
        return { text: response.text(), imageUrl };
      }

      const functionResponseParts: Part[] = [];
      for (const call of functionCalls) {
        const execResult = await toolExecutor.execute(call.name, call.args as Record<string, unknown>);
        if (!imageUrl && execResult.imageUrl) imageUrl = execResult.imageUrl;
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { content: execResult.content },
          },
        });
      }

      nextMessage = functionResponseParts;
    }

    // Fallback: last response text
    const final = await chat.sendMessage(nextMessage);
    return { text: final.response.text(), imageUrl };
  }
}
