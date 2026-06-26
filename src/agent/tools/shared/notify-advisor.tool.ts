import { ToolDefinition } from '../../agent.interfaces';

export const notifyAdvisorTool: ToolDefinition = {
  privileges: [],
  tool: {
    name: 'notify_advisor',
    description:
      'Notifica al asesor humano que un cliente solicita atención personalizada. Llama esta herramienta SIEMPRE que el cliente pida hablar con una persona, un asesor, o soporte humano.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description:
            'Resumen breve de lo que el cliente necesita o preguntó, para que el asesor tenga contexto antes de contactarlo.',
        },
      },
      required: ['summary'],
    },
  },
};
