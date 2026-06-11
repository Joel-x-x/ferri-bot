import Anthropic from '@anthropic-ai/sdk';
import { AiAdapter, AiChatResult, AiMessage, AiTool, AiToolExecutor, VendorNotification } from './ai-adapter.interface';

const MAX_TOOL_ROUNDS = 5;

export class AnthropicAdapter implements AiAdapter {
  private client: Anthropic;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'claude-haiku-4-5-20251001',
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    messages: AiMessage[],
    systemPrompt?: string,
    tools?: AiTool[],
    toolExecutor?: AiToolExecutor,
  ): Promise<AiChatResult> {
    const anthropicTools: Anthropic.Tool[] | undefined = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }));

    let imageUrl: string | undefined;
    let vendorNotification: VendorNotification | undefined;
    const chatMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: chatMessages,
        tools: anthropicTools,
      });

      if (response.stop_reason === 'tool_use' && toolExecutor) {
        chatMessages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const execResult = await toolExecutor.execute(block.name, block.input as Record<string, unknown>);
            if (!imageUrl && execResult.imageUrl) imageUrl = execResult.imageUrl;
            if (!vendorNotification && execResult.vendorNotification) vendorNotification = execResult.vendorNotification;
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: execResult.content,
            });
          }
        }
        chatMessages.push({ role: 'user', content: toolResults });
      } else {
        const block = response.content[0];
        const text = block?.type === 'text' ? block.text : '';
        return { text, imageUrl, vendorNotification };
      }
    }

    return { text: '', imageUrl, vendorNotification };
  }
}
