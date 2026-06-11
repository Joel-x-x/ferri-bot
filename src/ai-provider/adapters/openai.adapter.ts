import OpenAI from 'openai';
import { AiAdapter, AiChatResult, AiMessage, AiTool, AiToolExecutor } from './ai-adapter.interface';

const MAX_TOOL_ROUNDS = 5;

export class OpenAiAdapter implements AiAdapter {
  private client: OpenAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gpt-4o-mini',
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(
    messages: AiMessage[],
    systemPrompt?: string,
    tools?: AiTool[],
    toolExecutor?: AiToolExecutor,
  ): Promise<AiChatResult> {
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      chatMessages.push({ role: 'system', content: systemPrompt });
    }
    chatMessages.push(...messages.map((m) => ({ role: m.role, content: m.content })));

    const openAiTools: OpenAI.Chat.ChatCompletionTool[] | undefined = tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      },
    }));

    let imageUrl: string | undefined;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: chatMessages,
        tools: openAiTools,
        tool_choice: openAiTools?.length ? 'auto' : undefined,
      });

      const choice = response.choices[0];

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls && toolExecutor) {
        chatMessages.push(choice.message);
        for (const toolCall of choice.message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const execResult = await toolExecutor.execute(toolCall.function.name, args);
          if (!imageUrl && execResult.imageUrl) imageUrl = execResult.imageUrl;
          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: execResult.content,
          });
        }
      } else {
        return { text: choice.message.content ?? '', imageUrl };
      }
    }

    return { text: '', imageUrl };
  }
}
