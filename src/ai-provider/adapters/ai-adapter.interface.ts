export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiAdapter {
  chat(messages: AiMessage[], systemPrompt?: string): Promise<string>;
}
