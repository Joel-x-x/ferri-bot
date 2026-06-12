import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { BadRequestException } from '@nestjs/common';
import { AiAdapter, AiChatResult, AiMessage, AiTool, AiToolExecutor, VendorNotification } from './ai-adapter.interface';

const MAX_TOOL_ROUNDS = 5;
const RETRY_DELAYS_MS = [2000, 5000]; // 2s then 5s on 503

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is503 = msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand');
      if (!is503 || attempt === RETRY_DELAYS_MS.length) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

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
    let vendorNotification: VendorNotification | undefined;

    // Initial user message
    let nextMessage: string | Part[] = messages[messages.length - 1].content;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await withRetry(() => chat.sendMessage(nextMessage));
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (!functionCalls?.length || !toolExecutor) {
        return { text: response.text(), imageUrl, vendorNotification };
      }

      const functionResponseParts: Part[] = [];
      for (const call of functionCalls) {
        const execResult = await toolExecutor.execute(call.name, call.args as Record<string, unknown>);
        if (!imageUrl && execResult.imageUrl) imageUrl = execResult.imageUrl;
        if (!vendorNotification && execResult.vendorNotification) vendorNotification = execResult.vendorNotification;
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
    const final = await withRetry(() => chat.sendMessage(nextMessage));
    return { text: final.response.text(), imageUrl, vendorNotification };
  }
}
