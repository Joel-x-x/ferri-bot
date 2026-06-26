import { ToolDefinition } from '../../agent.interfaces';

export const searchProductsTool: ToolDefinition = {
  privileges: [],
  tool: {
    name: 'search_products',
    description:
      'Busca productos en el catálogo de la ferretería por nombre, categoría o descripción. Úsala cuando el cliente pregunte sobre precios, disponibilidad o productos específicos.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Término de búsqueda: nombre del producto, categoría o descripción',
        },
      },
      required: ['query'],
    },
  },
};
