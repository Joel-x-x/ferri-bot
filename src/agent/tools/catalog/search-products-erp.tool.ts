import { ToolDefinition } from '../../agent.interfaces';

export const searchProductsErpTool: ToolDefinition = {
  privileges: ['PRODUCT_READ'],
  internal: true,
  tool: {
    name: 'search_products_erp',
    description:
      'Busca productos en el ERP interno con precios completos (costo, mayorista, PVP). Úsala cuando necesites precios internos para cotizaciones internas o consultas de staff.',
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
