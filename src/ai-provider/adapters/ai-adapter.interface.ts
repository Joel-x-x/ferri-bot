export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResult {
  text: string;
  imageUrl?: string;
}

export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface AiToolExecutorResult {
  content: string;   // string fed back to the AI
  imageUrl?: string; // attached to the final WhatsApp reply
}

export interface AiToolExecutor {
  execute(name: string, args: Record<string, unknown>): Promise<AiToolExecutorResult>;
}

export interface AiAdapter {
  chat(
    messages: AiMessage[],
    systemPrompt?: string,
    tools?: AiTool[],
    toolExecutor?: AiToolExecutor,
  ): Promise<AiChatResult>;
}
