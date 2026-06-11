# FerriBot

Servicio multi-tenant de atención al cliente vía WhatsApp. Recibe mensajes de clientes, responde con IA usando catálogo de productos (Algolia), y notifica al vendedor cuando hay una cotización confirmada.

## Language

**Tenant**:
Empresa ferretera que usa FerriBot. Identificada por `tenantId`. Tiene sus propias credenciales Meta, proveedor IA y número de vendedor.
_Avoid_: cliente, empresa, cuenta

**Contacto (Contact)**:
Persona que escribe por WhatsApp al bot. Identificada por `contactPhone`. No tiene cuenta en el sistema.
_Avoid_: usuario, cliente (ambiguo con tenant)

**FerriBot**:
Nombre del asistente virtual que el contacto ve en WhatsApp. Responde en nombre del tenant. Siempre se identifica como bot.
_Avoid_: bot, asistente, agente

**Conversación (Conversation)**:
Hilo de mensajes entre un contacto y FerriBot para un tenant dado. Unidad: `(tenantId, contactPhone)`. El historial se lee de `message_history` (últimos 20 mensajes con contenido).
_Avoid_: sesión, chat, hilo

**Cotización (Quotation)**:
Lista de productos con cantidades y total estimado, generada por FerriBot en conversación a partir de búsquedas Algolia. Hoy vive solo en el hilo — no persiste en DB.
_Avoid_: presupuesto, pedido, orden

**Contexto de conversación (Conversation Context)**:
Array de mensajes `{ role, content }` pasado a la IA. Incluye mensajes INBOUND del contacto + mensajes OUTBOUND con `aiProcessed=true`. Excluye respuestas de operadores humanos.
_Avoid_: historial, memoria, estado

**Handoff**:
Momento en que FerriBot transfiere la conversación a un operador humano. Hoy: FerriBot solo indica un número de contacto. Futuro: desactiva `autoReply` para ese contacto.
_Avoid_: transferencia, escalado

**Número del vendedor (Sales Phone)**:
Número WhatsApp que recibe resúmenes de cotización. Hoy: `0978729311` hardcodeado. Futuro: campo por tenant.
_Avoid_: número admin, número interno

## Flujos

| ID | Nombre | Trigger | Estado |
|----|--------|---------|--------|
| A | Bienvenida | Primera conversación (historial vacío) | Pendiente implementación |
| B | Búsqueda de productos | Pregunta sobre precio/disponibilidad | ✅ Activo (Algolia function calling) |
| C | Cotización | Cliente pide cotizar uno o más productos | Pendiente implementación |
| D | Fuera de tema | Pregunta irrelevante al catálogo | ✅ Activo (IA responde con límites) |
| E | Handoff a humano | Cliente pide hablar con persona | TODO — ver TODO.md |

## Reglas de comportamiento FerriBot

1. Siempre se identifica como bot si le preguntan
2. Respuestas cortas por defecto — solo da detalles si el contacto los pide
3. Negrillas WhatsApp pegadas al texto: `*texto*` no `* texto *`
4. Precios siempre como "referenciales" — no garantizados
5. Al finalizar cotización: presenta resumen → pregunta confirmación → envía al vendedor
6. Total de cotización solo (sin desglose unitario)

## Integraciones

- **Meta Cloud API** — envío/recepción WhatsApp
- **Algolia** — búsqueda de productos (`index: products`, filtro: `tenantId + availableForSale:true`)
- **ferri-monolito** — emisor de JWT (`issuer: ferridescuentos`); FerriBot valida pero no llama HTTP por ahora
