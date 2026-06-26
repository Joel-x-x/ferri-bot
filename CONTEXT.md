# FerriBot

Servicio multi-tenant de atención al cliente vía WhatsApp. Soporta dos audiencias por tenant: clientes públicos (Agente Externo) y staff interno (Agente Interno). Cada audiencia recibe herramientas y precios distintos según su identidad.

## Language

**Tenant**:
Empresa ferretera que usa FerriBot. Identificada por `tenantId`. Tiene sus propias credenciales Meta, proveedor IA, número de vendedor y staff registrado.
_Avoid_: cliente, empresa, cuenta

**Contacto (Contact)**:
Persona que escribe por WhatsApp al bot. Identificada por `contactPhone`. No tiene cuenta en el sistema.
_Avoid_: usuario, cliente (ambiguo con tenant)

**Staff**:
Empleado del tenant cuyo `contactPhone` está vinculado a un `userId` de ferri-monolito en `staff_phones`. Sus roles y privilegios se heredan del RBAC de ferri-monolito (GERENTE, SELLER, CAJERO, etc.), lo que determina qué Tool Packs carga el Agente Interno.
_Avoid_: empleado, interno, admin

**FerriBot**:
Nombre del asistente virtual que el contacto ve en WhatsApp. Responde en nombre del tenant. Siempre se identifica como bot.
_Avoid_: bot, asistente, agente

**Agente (Agent)**:
Perfil de comportamiento que el motor de IA carga dinámicamente para una conversación. Define: system prompt, tools habilitados, nivel de acceso a datos. No es un proceso ni un servicio separado — es una configuración. Un solo `IncomingService` resuelve qué Agente aplicar.
_Avoid_: bot, modo, servicio, microservicio

**Agente Interno**:
Agente para contactos Staff. Acceso completo al ERP (costos, stock, contabilidad). Los tools disponibles varían según el Rol del Staff (gerente, bodeguero, contador, transportista). Renombrado de "Secretario".
_Avoid_: secretario (legacy), agente admin

**Agente Externo**:
Agente para contactos que son Clientes del tenant. Acceso a precios públicos + operaciones autenticadas (facturación, pedidos). Requiere que el contacto esté vinculado a un Cliente verificado para operaciones transaccionales. Renombrado de "Vendedor".
_Avoid_: vendedor (legacy), agente público

**Contacto Vinculado (Linked Contact)**:
Contacto cuyo `contactPhone` está mapeado a un `profileId` de ferri-monolito. Vinculación voluntaria — el contacto se identifica (RUC/cédula) cuando necesita operaciones transaccionales (factura, pedido). Antes de vincularse puede consultar catálogo libremente.
_Avoid_: cliente registrado, usuario autenticado

**Conversación (Conversation)**:
Hilo de mensajes entre un contacto y FerriBot para un tenant dado. Unidad: `(tenantId, contactPhone)`. El historial se lee de `message_history` (últimos 20 mensajes con contenido).
_Avoid_: sesión, chat, hilo

**Cotización (Quotation)**:
Lista de productos con cantidades y total estimado, generada por FerriBot en conversación. Hoy vive solo en el hilo — no persiste en DB.
_Avoid_: presupuesto, pedido, orden

**Contexto de conversación (Conversation Context)**:
Array de mensajes `{ role, content }` pasado a la IA. Incluye mensajes INBOUND del contacto + mensajes OUTBOUND con `aiProcessed=true`. Excluye respuestas de operadores humanos. Siempre empieza con rol `user`.
_Avoid_: historial, memoria, estado

**Flujo con estado (Stateful Flow)**:
Flujo conversacional multi-paso que muta datos persistentes (en ferri-monolito o contact_profiles). Usa estado explícito en `conversation_sessions` con expiración. Ejemplos: vinculación, facturación, pedidos. Flujos que solo consultan o generan texto NO usan estado explícito.
_Avoid_: wizard, state machine, workflow

**Handoff**:
Momento en que FerriBot transfiere la conversación a un operador humano vía `notify_advisor` tool. El asesor recibe resumen por WhatsApp.
_Avoid_: transferencia, escalado

**Número del vendedor (Sales Phone)**:
Número WhatsApp por tenant que recibe notificaciones de cotizaciones y handoffs. Campo `salesPhone` en `meta_credentials`.
_Avoid_: número admin, número interno

**Sesión WhatsApp (WA Session)**:
JWT real del usuario (staff o cliente) obtenido vía Google OAuth o OTP por email. Permite al bot llamar a ferri-monolito con la identidad del usuario, no como servicio anónimo. TTL configurable: 7 días staff, 24h clientes. Almacenada cifrada (AES) en `conversations.session_token`. Invalidable desde la web.
_Avoid_: token de sesión, session cookie

**SuperAdmin**:
Equipo Ferridescuentos (desarrolladores). Gestiona defaults globales del SaaS en `saas_config`. Define límites máximos/mínimos que los Tenant Admin pueden ajustar. No es un rol RBAC — es el operador de la plataforma.
_Avoid_: admin global, root

**Configuración SaaS (SaaS Config)**:
Par key-value en `saas_config` que define defaults globales (TTLs, límites, feature flags). Incluye `data_type` y `min_value`/`max_value` para validar overrides de tenant. Cascade: `tenant_config[key] → saas_config[key] → hardcoded default`.
_Avoid_: settings, preferencias, variables de entorno

**Service API Key**:
Clave de autenticación generada por ferri-monolito para operaciones sin usuario (notificaciones push, batch jobs, health checks). NO se usa para operaciones de staff o cliente — esas usan JWT vía Sesión WhatsApp. Hash SHA-256 almacenado en `service_api_keys`.
_Avoid_: token de servicio, API token

**ERP Client**:
Servicio en ferri-bot que llama ferri-monolito. Usa JWT del usuario autenticado para operaciones de staff/cliente. Usa Service API Key solo para operaciones sin usuario.
_Avoid_: backend client, monolito client

## Flujos

| ID | Nombre | Trigger | Estado |
|----|--------|---------|--------|
| A | Bienvenida | Primera conversación (historial vacío) | ✅ Activo |
| B | Búsqueda Agente Externo | Contacto no-Staff pregunta por producto | ✅ Activo (Algolia) |
| C | Búsqueda Agente Interno | Staff pregunta por producto | 🔨 Implementando (ERP) |
| D | Cotización | Contacto pide cotizar productos | Pendiente persistencia |
| E | Handoff a humano | Contacto pide hablar con persona | ✅ Activo (notify_advisor) |
| F | Fuera de tema | Pregunta irrelevante al catálogo | ✅ Activo |

## Routing de agente

```
Mensaje entrante
  └─ isStaff(tenantId, contactPhone)?
       ├─ YES → Agente Interno (ERP tools: precios costo+mayorista+PVP)
       └─ NO  → Agente Externo (Algolia tools: solo PVP)
```

Determinístico — sin LLM extra para routing. `staff_phones(tenantId, phone)` es la fuente de verdad.

## Reglas de comportamiento

1. Siempre se identifica como bot si le preguntan
2. Respuestas cortas por defecto — solo da detalles si el contacto los pide
3. Negrillas WhatsApp pegadas al texto: `*texto*` no `* texto *`
4. Precios siempre como "referenciales" — no garantizados
5. **Agente Interno**: muestra costo, mayorista y PVP claramente diferenciados
6. **Agente Externo**: nunca menciona costo ni mayorista
7. Al finalizar cotización: presenta resumen → pregunta confirmación → envía al vendedor

## Integraciones

- **Meta Cloud API** — envío/recepción WhatsApp
- **Algolia** — búsqueda Vendedor (`index: products`, filtro: `tenantId + availableForSale:true`)
- **ferri-monolito** — ERP: staff autenticado con JWT (Sesión WhatsApp), operaciones sin usuario con API Key
