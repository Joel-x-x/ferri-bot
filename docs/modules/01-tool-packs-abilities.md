# Tool Packs / Habilidades

Estado: **En diseño** | Fecha: 2026-06-25

---

## Concepto

Un **Tool Pack** es un conjunto de tools que se habilita según los privilegios RBAC del usuario. Cada tool tiene un privilegio requerido — si el usuario lo tiene, el tool se carga. Si no, no existe para esa conversación.

Los Tool Packs son **aditivos**: más privilegios = más tools. Nunca sustractivos.

## Arquitectura

```typescript
// tool-registry.ts
const TOOL_PRIVILEGE_MAP: Record<string, ToolDefinition> = {
  // ── Sin privilegio (Agente Externo) ──
  'search_products':       { privileges: [], description: 'Buscar en catálogo público (Algolia)' },
  'send_quotation':        { privileges: [], description: 'Enviar cotización al vendedor' },
  'notify_advisor':        { privileges: [], description: 'Handoff a humano' },

  // ── Contacto Vinculado (sin privilegio, requiere vinculación) ──
  'request_invoice':       { privileges: [], linked: true, description: 'Solicitar factura' },
  'track_order':           { privileges: [], linked: true, description: 'Rastrear pedido propio' },

  // ── Agente Interno (privilegios RBAC) ──
  'search_products_erp':   { privileges: ['PRODUCT_READ'], description: 'Buscar con precios completos (costo/mayorista/PVP)' },
  'check_stock':           { privileges: ['INVENTORY_READ'], description: 'Consultar stock por bodega' },
  'create_invoice':        { privileges: ['INVOICE_WRITE'], description: 'Generar factura electrónica' },
  'manage_orders':         { privileges: ['ORDER_ADMIN'], description: 'Crear/actualizar pedidos' },
  'view_reports':          { privileges: ['REPORT_READ'], description: 'Dashboard y reportes' },
  'manage_customers':      { privileges: ['CUSTOMER_WRITE'], description: 'Crear/editar clientes' },

  // ── Cheques (ver módulo 02) ──
  'register_cheque':       { privileges: ['CHEQUE_WRITE'], description: 'Registrar cheque recibido' },
  'list_cheques':          { privileges: ['CHEQUE_READ'], description: 'Listar cheques pendientes/vencidos' },
  'cheque_reminders':      { privileges: ['CHEQUE_READ'], description: 'Consultar recordatorios de vencimiento' },

  // ── Knowledge Base (ver módulo 03) ──
  'query_kb':              { privileges: [], internal: true, description: 'Consultar base de conocimiento interna' },
  'update_kb':             { privileges: ['KB_WRITE'], description: 'Agregar/actualizar entrada en KB' },

  // ── Despachos (futuro) ──
  'view_my_dispatches':    { privileges: ['DISPATCH_READ'], description: 'Ver despachos asignados' },
  'update_dispatch_status':{ privileges: ['DISPATCH_WRITE'], description: 'Actualizar estado de despacho' },
};
```

## Resolución

```typescript
function resolveTools(agent: 'INTERNAL' | 'EXTERNAL', context: AgentContext): Tool[] {
  return Object.entries(TOOL_PRIVILEGE_MAP)
    .filter(([_, def]) => {
      // Filtrar por tipo de agente
      if (agent === 'EXTERNAL' && def.internal) return false;
      if (agent === 'EXTERNAL' && def.privileges.length > 0) return false;

      // Filtrar por vinculación
      if (def.linked && !context.isLinkedContact) return false;

      // Filtrar por privilegios
      return def.privileges.every(p => context.authorities.includes(p));
    })
    .map(([toolName]) => getToolImplementation(toolName));
}
```

## Ejemplos por rol

| Rol | Tools habilitados |
|-----|------------------|
| **Cliente (no vinculado)** | search_products, send_quotation, notify_advisor |
| **Cliente (vinculado)** | + request_invoice, track_order |
| **Vendedor** | search_products_erp, manage_orders, manage_customers + públicos |
| **Cajero** | search_products_erp, check_stock, create_invoice, manage_orders + públicos |
| **Bodeguero** | check_stock + públicos |
| **Gerente** | Todos los internos + públicos |
| **Contador** | list_cheques, cheque_reminders, view_reports + públicos |
| **Transportista** | view_my_dispatches, update_dispatch_status + públicos |

## Extensibilidad

Agregar nueva habilidad = 3 pasos:
1. Definir privilegio en ferri-monolito RBAC (ej: `CHEQUE_READ`)
2. Agregar entrada en `TOOL_PRIVILEGE_MAP`
3. Implementar el tool (función + endpoint en monolito si necesita datos)

Sin migración en ferri-bot. Sin cambiar routing. Sin tocar otros tools.

## Estructura de archivos

**Decisión: agrupados por módulo de negocio.** Cada tool es un archivo que exporta `ToolDefinition`. El registry auto-descubre al arrancar.

```
src/agent/tools/
├── catalog/
│   ├── search-products.tool.ts
│   ├── search-products-erp.tool.ts
│   └── send-product-list.tool.ts
├── sales/
│   ├── send-quotation.tool.ts
│   ├── create-invoice.tool.ts
│   └── manage-orders.tool.ts
├── cheques/
│   ├── register-cheque.tool.ts
│   └── list-cheques.tool.ts
├── kb/
│   ├── query-kb.tool.ts
│   └── update-kb.tool.ts
├── contact/
│   ├── request-invoice.tool.ts
│   ├── track-order.tool.ts
│   └── update-contact-memory.tool.ts
├── dispatch/
│   ├── view-my-dispatches.tool.ts
│   └── update-dispatch-status.tool.ts
└── shared/
    ├── notify-advisor.tool.ts
    └── send-confirmation.tool.ts
```

Cada archivo:

```typescript
// register-cheque.tool.ts
export const registerChequeTool: ToolDefinition = {
  name: 'register_cheque',
  privileges: ['CHEQUE_WRITE'],
  description: 'Registrar cheque recibido',
  parameters: { /* JSON Schema */ },
  execute: async (params, context) => { /* ... */ }
};
```

## Decisiones pendientes

- [x] ¿Cada tool es un archivo separado o se agrupan por módulo de negocio? → **Por módulo**
- [x] ¿Tool definitions incluyen JSON Schema para parámetros? → **Sí, ya funciona así con los adapters actuales**
