# Plan de Arquitectura de Agentes — FerriBot

Estado: **En diseño** | Fecha inicio: 2026-06-24

---

## 1. Visión general

FerriBot evoluciona de 2 modos hardcodeados (Secretario/Vendedor) a una **arquitectura de agentes basada en configuración**, escalable y mantenible. El objetivo: soportar N roles de negocio sin tocar el motor de routing cada vez.

---

## 2. Definiciones clave

### Agente
**Perfil de comportamiento** (system prompt + tools + acceso a datos) que el motor de IA carga dinámicamente para una conversación. No es un proceso, no es un microservicio. Un solo `IncomingService` resuelve qué Agente aplicar.

### Dos agentes base

| Agente | Audiencia | Routing | Acceso datos |
|--------|-----------|---------|-------------|
| **Interno** | Staff del tenant (bodeguero, gerente, contador, transportista, vendedor interno) | `staff_phones.userId` → roles RBAC → tool packs | ERP completo (costos, stock, contabilidad). Tools varían según privilegios del usuario |
| **Externo** | Clientes del tenant | Contacto no-Staff | Precios públicos (Algolia). Operaciones transaccionales (factura, pedido) requieren vinculación voluntaria con `profileId` de ferri-monolito |

### Contacto Vinculado
Contacto Externo cuyo `contactPhone` está mapeado a un `profileId` de ferri-monolito. Vinculación voluntaria — el contacto se identifica (RUC/cédula) cuando necesita facturar o hacer pedido. Antes de vincularse puede consultar catálogo libremente.

---

## 3. Routing de agente

```
Mensaje entrante (tenantId, contactPhone)
  │
  ├─ isStaff(tenantId, contactPhone)?
  │    │
  │    ├─ YES → Agente Interno
  │    │         │
  │    │         ├─ Resolver userId desde staff_phones
  │    │         ├─ Obtener privilegios desde ferri-monolito (cache TTL 5 min)
  │    │         ├─ Filtrar Tool Pack según privilegios
  │    │         └─ Cargar system prompt base + extensiones por privilegios
  │    │
  │    └─ NO → Agente Externo
  │              │
  │              ├─ Tools públicos (búsqueda, cotización, handoff)
  │              ├─ ¿Contacto Vinculado? (contactPhone → profileId)
  │              │    ├─ SÍ → + Tools transaccionales (facturar, pedir)
  │              │    └─ NO → Solo consulta. Si pide factura → flujo de vinculación
  │              └─ Cargar system prompt de atención al cliente
```

**Determinístico** — sin LLM extra para routing. `staff_phones` es la fuente de verdad para Staff, `contact_profiles` para vinculación de clientes.

---

## 4. RBAC: reutilización de ferri-monolito

**Decisión: ferri-bot NO implementa su propio sistema de roles.** Reutiliza el RBAC existente de ferri-monolito.

### Flujo de resolución de privilegios

```
staff_phones (ferri-bot DB)
  ├─ tenant_id
  ├─ phone
  ├─ user_id  ← NUEVO: vincula al usuario de ferri-monolito
  └─ is_active

          │
          ▼

GET /api/v1/auth/users/{userId}/authorities  (ferri-monolito)
  → Response: { roles: ["GERENTE", "SELLER"], authorities: ["PRODUCT_READ", "ORDER_ADMIN", ...] }
  → Cacheado en ferri-bot con TTL 5 minutos (Caffeine/in-memory)
```

### Roles existentes en ferri-monolito

| System Role | Privilegios principales |
|---|---|
| ADMIN | Todos (20 authorities) |
| DEVELOPER | Todos (20 authorities) |
| GERENTE | Todos excepto USER_WRITE, RBAC_ADMIN |
| SELLER | PRODUCT_*, CUSTOMER_*, ORDER_*, STORAGE_* |
| CAJERO | PRODUCT_READ, CUSTOMER_READ, INVENTORY_READ, ORDER_*, INVOICE_* |
| CUSTOMER | Ninguno (acceso vía `isAuthenticated()`) |
| SUPPLIER | Ninguno (futuro) |

Roles personalizados por tenant también son soportados — el admin puede crear roles custom con cualquier combinación de privilegios desde la web.

---

## 5. Tool Packs — Mapeo privilegio → tools

**Decisión: hardcoded en código con un registry.** Todos los tenants son ferreterías con el mismo modelo de negocio. Configurable por tenant es complejidad innecesaria hoy.

```typescript
// tool-registry.ts
const TOOL_PRIVILEGE_MAP: Record<string, string[]> = {
  // ── Tools públicos (Agente Externo, sin privilegio) ──
  'search_products':     [],              // Algolia, catálogo público
  'send_quotation':      [],              // cotización referencial
  'notify_advisor':      [],              // handoff a humano

  // ── Tools Agente Interno (requieren privilegios RBAC) ──
  'search_products_erp': ['PRODUCT_READ'],      // precios costo+mayorista+PVP
  'check_stock':         ['INVENTORY_READ'],     // consultar stock por bodega
  'create_invoice':      ['INVOICE_WRITE'],      // generar factura electrónica
  'manage_orders':       ['ORDER_ADMIN'],        // crear/actualizar pedidos
  'view_reports':        ['REPORT_READ'],        // dashboard y reportes
  'manage_customers':    ['CUSTOMER_WRITE'],     // crear/editar clientes

  // ── Tools Agente Externo autenticado (Contacto Vinculado) ──
  'request_invoice':     [],              // solicitar factura (requiere vinculación, no privilegio)
  'track_order':         [],              // rastrear pedido propio
  'view_my_prices':      [],              // ver precios negociados
};
```

### Resolución de tools para un Staff

```typescript
function resolveTools(authorities: string[]): Tool[] {
  return Object.entries(TOOL_PRIVILEGE_MAP)
    .filter(([_, requiredPrivileges]) =>
      requiredPrivileges.every(p => authorities.includes(p))
    )
    .map(([toolName]) => getToolDefinition(toolName));
}
```

### Ejemplos por rol

| Rol | Privilegios | Tools habilitados |
|-----|------------|-------------------|
| GERENTE | Todos | `search_products_erp` + `check_stock` + `create_invoice` + `manage_orders` + `view_reports` + `manage_customers` + todos los públicos |
| SELLER | PRODUCT_*, ORDER_*, CUSTOMER_* | `search_products_erp` + `manage_orders` + `manage_customers` + públicos |
| CAJERO | PRODUCT_READ, ORDER_*, INVOICE_*, INVENTORY_READ | `search_products_erp` + `check_stock` + `create_invoice` + `manage_orders` + públicos |
| Bodeguero (custom) | INVENTORY_READ, INVENTORY_WRITE | `check_stock` + públicos |
| Transportista (custom) | ORDER_READ | públicos (+ futuro `view_dispatches`) |

---

## 6. Cambios en base de datos

### ferri-bot

```sql
-- staff_phones: agregar user_id
ALTER TABLE staff_phones ADD COLUMN user_id UUID;
-- No NOT NULL por migración gradual. Nuevo registro sí requiere user_id.

-- contact_profiles: mapeo contacto → cliente ferri-monolito
CREATE TABLE contact_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  profile_id  UUID NOT NULL,          -- profileId en ferri-monolito
  verified    BOOLEAN DEFAULT FALSE,  -- verificado por RUC/cédula
  verified_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);
CREATE INDEX idx_contact_profiles_tenant_phone ON contact_profiles(tenant_id, phone);
```

### ferri-monolito

```
-- Nuevo endpoint (o reutilizar existente):
GET /internal/users/{userId}/authorities
  → { roles: ["GERENTE"], authorities: ["PRODUCT_READ", ...] }
  → Autenticado con Service API Key (X-Api-Key)
```

---

## 7. System prompts dinámicos

El system prompt se compone dinámicamente según el agente y privilegios:

```typescript
function buildSystemPrompt(agent: 'INTERNAL' | 'EXTERNAL', context: AgentContext): string {
  const parts: string[] = [BASE_PROMPT];

  if (agent === 'INTERNAL') {
    parts.push(INTERNAL_BASE_RULES);

    if (context.authorities.includes('PRODUCT_READ')) {
      parts.push(PRICING_RULES);  // "Muestra costo, mayorista y PVP diferenciados"
    }
    if (context.authorities.includes('INVENTORY_READ')) {
      parts.push(INVENTORY_RULES);  // "Reporta stock por bodega"
    }
    if (context.authorities.includes('REPORT_READ')) {
      parts.push(REPORT_RULES);  // "Genera resúmenes de ventas"
    }
  } else {
    parts.push(EXTERNAL_BASE_RULES);

    if (context.isLinkedContact) {
      parts.push(LINKED_CONTACT_RULES);  // "Puede facturar, mostrar historial"
    }
  }

  parts.push(context.tenantCustomPrompt);  // system prompt custom del tenant
  return parts.join('\n\n');
}
```

---

## 8. Arquitectura de archivos (propuesta)

```
ferri-bot/src/
├── agent/                          ← NUEVO módulo
│   ├── agent.module.ts
│   ├── agent-resolver.service.ts   // isStaff? → Interno/Externo
│   ├── tool-registry.ts            // TOOL_PRIVILEGE_MAP
│   ├── prompt-builder.service.ts   // buildSystemPrompt()
│   └── authority-cache.service.ts  // cache de privilegios (TTL 5 min)
├── whatsapp/
│   ├── incoming/
│   │   └── incoming.service.ts     // refactored: usa AgentResolver
│   ├── staff/
│   │   └── staff-phone.service.ts  // + resolución userId
│   └── ...
├── contact/                        ← NUEVO módulo
│   ├── contact.module.ts
│   ├── contact-profile.entity.ts   // (tenantId, phone) → profileId
│   └── contact-profile.service.ts  // vinculación voluntaria
├── erp/
│   └── erp-client.service.ts       // + endpoint authorities
└── ...
```

---

## 9. Fases de implementación

### Fase 1 — Refactor base (sin funcionalidad nueva)
- [ ] Crear módulo `agent/` con `AgentResolver`, `ToolRegistry`, `PromptBuilder`
- [ ] Refactorizar `IncomingService`: extraer lógica de routing a `AgentResolver`
- [ ] Migrar tool definitions actuales al `ToolRegistry`
- [ ] Migrar system prompt hardcodeado a `PromptBuilder`
- [ ] Tests: mismo comportamiento que antes del refactor

### Fase 2 — RBAC integration
- [ ] Agregar `user_id` a `staff_phones` (migración SQL)
- [ ] Crear endpoint en ferri-monolito: `GET /internal/users/{userId}/authorities`
- [ ] Implementar `AuthorityCacheService` (call + cache TTL 5 min)
- [ ] `AgentResolver` resuelve tools dinámicamente según privilegios
- [ ] UI admin: al registrar Staff, seleccionar usuario existente (vincula `userId`)

### Fase 3 — Contacto Vinculado (Agente Externo autenticado)
- [ ] Crear tabla `contact_profiles` (migración SQL)
- [ ] Crear módulo `contact/` con servicio de vinculación
- [ ] Implementar flujo conversacional: "Dame tu cédula/RUC" → buscar en monolito → vincular
- [ ] Tools transaccionales: `request_invoice`, `track_order`

### Fase 4 — Tools de negocio
- [ ] `check_stock` → `GET /internal/inventory/...`
- [ ] `create_invoice` → `POST /internal/invoices/...`
- [ ] `manage_orders` → `POST /internal/orders/...`
- [ ] `view_reports` → `GET /internal/reports/...`
- [ ] Cada tool = endpoint interno en ferri-monolito + definición en `ToolRegistry`

### Fase 5 — Roles custom por tenant
- [ ] Tenants crean roles custom en la web (ya soportado por RBAC)
- [ ] ferri-bot resuelve automáticamente (hereda privilegios → filtra tools)
- [ ] Sin código nuevo en ferri-bot — funciona por diseño

---

## 10. Principios de diseño

1. **ferri-monolito es la fuente de verdad** — roles, privilegios, clientes, facturas, inventario. ferri-bot solo consume.
2. **Un agente = una configuración, no un proceso** — escalás agregando tools al registry, no servicios.
3. **Routing determinístico** — sin LLM para decidir qué agente cargar. `staff_phones` + RBAC resuelve.
4. **Tool packs aditivos** — más privilegios = más tools. Nunca sustractivos.
5. **Seguridad por diseño** — un contacto sin privilegio NUNCA ve un tool que requiere ese privilegio. Falla cerrada.
6. **Cache con TTL** — privilegios cacheados 5 min. Cambio en web se refleja sin restart.
7. **Vinculación voluntaria** — el Agente Externo funciona sin login. Solo pide identificación para operaciones transaccionales.

---

## Decisiones resueltas (grill session 2026-06-25)

- [x] **Tool Registry** → Hardcoded en código, agrupado por módulo de negocio (`tools/catalog/`, `tools/cheques/`, etc.)
- [x] **State de conversación** → Modelo híbrido. Flujos que mutan datos usan estado explícito (vinculación, facturación, pedidos). Consultas normales sin estado.
- [x] **Entidad Conversation** → Singleton `UNIQUE(tenant_id, phone, channel)` con `conversation_events` para métricas/auditoría. No múltiples conversaciones.
- [x] **System prompt del tenant** → Secciones: SECURITY_RULES (inmutable) + BASE_PROMPT + ROLE_EXTENSIONS + tenant prompt (sandboxed) + contactMemory. Tenant NO puede sobreescribir reglas de seguridad.
- [x] **Seguridad LLM** → 5 capas: Input Guard (patrones injection), Prompt Hardening (reglas inmutables), Tool Validation (schema + rate limit), Output Filter (leak detection), Monitoreo (alertas + bloqueo)
- [x] **Auth model** → JWT por usuario (Google OAuth / OTP email), no API Key para operaciones de usuario. API Key solo para operaciones sin usuario (push, batch). Bot llama monolito con JWT real → mismos endpoints que web, auditoría real.
- [x] **Endpoints monolito** → Reutilizar `/api/v1/` existentes con JWT del usuario. `/internal/` solo para operaciones exclusivas service-to-service sin usuario.
- [x] **Sesiones WhatsApp** → TTL 7 días staff / 24h clientes (configurable por tenant). Tabla `wa_sessions` en monolito. Cerrables desde web (usuario o admin). Cache validación 5 min.

## Decisiones pendientes

- [ ] ¿Cómo se maneja el handoff cuando el Staff cambia de contexto? (ej: gerente pregunta por stock y luego por reportes en la misma conversación)

## Módulos documentados

Documentación detallada por módulo en `docs/modules/`:

| # | Módulo | Descripción |
|---|--------|------------|
| 01 | Tool Packs | Sistema de habilidades aditivas por privilegios RBAC |
| 02 | Cheques | Registro, seguimiento y recordatorios |
| 03 | Knowledge Base | Blog interno actualizable por WhatsApp |
| 04 | Data Access Control | Campos visibles según rol |
| 05 | Media Processing | Audio STT + Imagen OCR con confirmación |
| 06 | Rate Limiting | Límites progresivos para clientes |
| 07 | AI Memory | Memoria resumida del contacto |
| 08 | WhatsApp Interactive | Listas, botones, componentes nativos |
| 09 | Alerting | Monitoreo y alertas por anomalías |
| 10 | Security | 5 capas de defensa contra prompt injection y abuso |
| 11 | Auth & Sessions | JWT por usuario vía Google OAuth / OTP. Gestión de sesiones desde web |
