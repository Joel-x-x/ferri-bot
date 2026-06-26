import { ToolDefinition } from '../../agent.interfaces';

export const sendQuotationTool: ToolDefinition = {
  privileges: [],
  tool: {
    name: 'send_quotation',
    description:
      'Envía la cotización confirmada al asesor de ventas. Llama esta herramienta solo cuando el cliente haya confirmado explícitamente que desea enviar la cotización.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'string',
          description:
            'Lista de productos con cantidades, uno por línea. Ej: "Cemento Chimborazo × 3\\nTornillo hex 1/2 × 100"',
        },
        total: {
          type: 'string',
          description: 'Total estimado en formato "$XX.XX" o "No disponible" si no se pudo calcular',
        },
      },
      required: ['items', 'total'],
    },
  },
};
