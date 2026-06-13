# FerriBot

Servicio multi-tenant de atención al cliente vía WhatsApp. Soporta dos audiencias por tenant: clientes públicos (Vendedor) y staff interno (Secretario). Cada audiencia recibe herramientas y precios distintos según su identidad.

## Language

**Tenant**:
Empresa ferretera que usa FerriBot. Identificada por `tenantId`. Tiene sus propias credenciales Meta, proveedor IA, número de vendedor y staff registrado.
_Avoid_: cliente, empresa, cuenta

**Contacto (Contact)**:
Persona que escribe por WhatsApp al bot. Identificada por `contactPhone`. No tiene cuenta en el sistema.
_Avoid_: usuario, cliente (ambiguo con tenant)

**Staff**:
Empleado del tenant cuyo `contactPhone` está registrado en `staff_phones`. Recibe herramientas del Secretario (precios completos). Un contacto no-staff recibe herramientas del Vendedor (solo PVP).
_Avoid_: empleado, interno, admin

**FerriBot**:
Nombre del asistente virtual que el contacto ve en WhatsApp. Responde en nombre del tenant. Siempre se identifica como bot.
_Avoid_: bot, asistente, agente

**Secretario**:
Modo de operación del agente IA cuando el contacto es Staff. Tiene acceso a precios completos (costo, mayorista, minorista) vía ERP. Nunca expone costo a contactos no-Staff.
_Avoid_: agente interno, modo admin

**Vendedor**:
Modo de operación del agente IA cuando el contacto NO es Staff. Solo usa Algolia (PVP público). Nunca accede al ERP ni muestra precios de costo.
_Avoid_: agente público, modo cliente

**Conversación (Conversation)**:
Hilo de mensajes entre un contacto y FerriBot para un tenant dado. Unidad: `(tenantId, contactPhone)`. El historial se lee de `message_history` (últimos 20 mensajes con contenido).
_Avoid_: sesión, chat, hilo

**Cotización (Quotation)**:
Lista de productos con cantidades y total estimado, generada por FerriBot en conversación. Hoy vive solo en el hilo — no persiste en DB.
_Avoid_: presupuesto, pedido, orden

**Contexto de conversación (Conversation Context)**:
Array de mensajes `{ role, content }` pasado a la IA. Incluye mensajes INBOUND del contacto + mensajes OUTBOUND con `aiProcessed=true`. Excluye respuestas de operadores humanos. Siempre empieza con rol `user`.
_Avoid_: historial, memoria, estado

**Handoff**:
Momento en que FerriBot transfiere la conversación a un operador humano vía `notify_advisor` tool. El asesor recibe resumen por WhatsApp.
_Avoid_: transferencia, escalado

**Número del vendedor (Sales Phone)**:
Número WhatsApp por tenant que recibe notificaciones de cotizaciones y handoffs. Campo `salesPhone` en `meta_credentials`.
_Avoid_: número admin, número interno

**Service API Key**:
Clave de autenticación no-expirante generada por ferri-monolito para acceso de servicio a servicio. ferri-bot la usa para llamar al ERP con header `X-Api-Key`. Hash SHA-256 almacenado en `service_api_keys`.
_Avoid_: token de servicio, API token

**ERP Client**:
Servicio en ferri-bot que llama ferri-monolito usando la Service API Key del tenant. Solo usado por el Secretario.
_Avoid_: backend client, monolito client

## Flujos

| ID | Nombre | Trigger | Estado |
|----|--------|---------|--------|
| A | Bienvenida | Primera conversación (historial vacío) | ✅ Activo |
| B | Búsqueda Vendedor | Contacto no-Staff pregunta por producto | ✅ Activo (Algolia) |
| C | Búsqueda Secretario | Staff pregunta por producto | 🔨 Implementando (ERP) |
| D | Cotización | Contacto pide cotizar productos | Pendiente persistencia |
| E | Handoff a humano | Contacto pide hablar con persona | ✅ Activo (notify_advisor) |
| F | Fuera de tema | Pregunta irrelevante al catálogo | ✅ Activo |

## Routing de agente

```
Mensaje entrante
  └─ isStaff(tenantId, contactPhone)?
       ├─ YES → Secretario (ERP tools: precios costo+mayorista+PVP)
       └─ NO  → Vendedor (Algolia tools: solo PVP)
```

Determinístico — sin LLM extra para routing. `staff_phones(tenantId, phone)` es la fuente de verdad.

## Reglas de comportamiento

1. Siempre se identifica como bot si le preguntan
2. Respuestas cortas por defecto — solo da detalles si el contacto los pide
3. Negrillas WhatsApp pegadas al texto: `*texto*` no `* texto *`
4. Precios siempre como "referenciales" — no garantizados
5. **Secretario**: muestra costo, mayorista y PVP claramente diferenciados
6. **Vendedor**: nunca menciona costo ni mayorista
7. Al finalizar cotización: presenta resumen → pregunta confirmación → envía al vendedor

## Integraciones

- **Meta Cloud API** — envío/recepción WhatsApp
- **Algolia** — búsqueda Vendedor (`index: products`, filtro: `tenantId + availableForSale:true`)
- **ferri-monolito** — ERP: autenticado con Service API Key (`X-Api-Key`), solo Secretario
