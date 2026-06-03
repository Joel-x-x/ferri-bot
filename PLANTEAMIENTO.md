# ferri-bot — Planteamiento de Proyecto

Servicio NestJS de mensajería WhatsApp multi-tenant con IA desacoplada.  
Nuevo proyecto desde cero. No hereda código de `ferri-IA`.

---

## Stack decidido

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | NestJS 11 + TypeScript | Consistente con ferri-monolito |
| WhatsApp | @whiskeysockets/baileys | Sin Puppeteer, WebSocket nativo, TypeScript, multi-device |
| Auth | JWT (mismo issuer/secret que ferri-monolito) | tenantId del claim mapea a sesión WA |
| ORM | TypeORM + PostgreSQL | Multi-tenant nativo, GKE-compatible |
| Realtime | Socket.io (@nestjs/platform-socket.io) | Eventos entrantes al cliente |
| Webhooks | HTTP POST firmado HMAC-SHA256 | Forward de eventos a sistemas externos |
| AI | Adaptador desacoplado (Gemini/OpenAI/Anthropic/Custom) | Solo se agrega token en DB |
| Contenedor | Docker Compose (dev) | PostgreSQL en puerto 5434 (no colisiona con monolito 5433) |

---

## Arquitectura de módulos

```
ferri-bot/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/                  # envs.ts con Joi validation
│   │
│   ├── database/                # TypeORM config + PostgreSQL connection
│   │
│   ├── shared/
│   │   ├── guards/              # JwtAuthGuard
│   │   ├── decorators/          # @CurrentTenant(), @CurrentUser()
│   │   └── interceptors/        # LoggingInterceptor, MdcInterceptor
│   │
│   ├── whatsapp/
│   │   ├── session/             # Sesiones Baileys multi-tenant
│   │   ├── messaging/           # Envío de mensajes (todos los tipos)
│   │   ├── incoming/            # Recepción y procesamiento
│   │   ├── webhook/             # Subscripciones HTTP externas
│   │   └── gateway/             # WebSocket Socket.io
│   │
│   └── ai-provider/             # Adaptador AI desacoplado por tenant
│
├── docker-compose.dev.yml
├── .env.template
└── PLANTEAMIENTO.md             ← este archivo
```

---

## Base de datos PostgreSQL — tablas

### `whatsapp_sessions`
```
id              UUID PK DEFAULT gen_random_uuid()
tenant_id       VARCHAR(100) UNIQUE NOT NULL
status          ENUM: PENDING | QR_READY | CONNECTING | CONNECTED | DISCONNECTED | LOGGED_OUT
auth_state      TEXT   ← AES-256 encriptado (creds + keys de Baileys)
phone_number    VARCHAR(20)
qr_code         TEXT   ← base64, válido ~60s
reconnect_count INT DEFAULT 0
created_at      TIMESTAMP DEFAULT now()
updated_at      TIMESTAMP DEFAULT now()
```

### `message_history`
```
id                UUID PK
tenant_id         VARCHAR(100) NOT NULL
jid               VARCHAR(100) NOT NULL   ← número@s.whatsapp.net o grupo@g.us
message_id        VARCHAR(100)
direction         ENUM: INBOUND | OUTBOUND
type              ENUM: TEXT | IMAGE | AUDIO | VIDEO | DOCUMENT | STICKER | REACTION
content           TEXT
media_url         VARCHAR(500)            ← solo URLs externas, no almacenamos archivos
quoted_message_id VARCHAR(100)
status            ENUM: PENDING | SENT | DELIVERED | READ | FAILED
ai_processed      BOOLEAN DEFAULT false
created_at        TIMESTAMP DEFAULT now()

INDEX (tenant_id, jid)
INDEX (tenant_id, created_at DESC)
```

### `webhook_subscriptions`
```
id          UUID PK
tenant_id   VARCHAR(100) NOT NULL
url         VARCHAR(500) NOT NULL
events      TEXT[]   ← ['message.received','message.sent','session.connected',...]
secret      VARCHAR(200)   ← para HMAC-SHA256 en header X-Ferri-Signature
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMP DEFAULT now()
updated_at  TIMESTAMP DEFAULT now()
```

### `ai_providers`
```
id             UUID PK
tenant_id      VARCHAR(100) UNIQUE NOT NULL
provider       ENUM: GEMINI | OPENAI | ANTHROPIC | CUSTOM
api_key        TEXT    ← AES-256 encriptado
model          VARCHAR(100)
system_prompt  TEXT
base_url       VARCHAR(500)   ← solo para CUSTOM
is_active      BOOLEAN DEFAULT true
auto_reply     BOOLEAN DEFAULT false   ← activa auto-respuesta IA entrante
created_at     TIMESTAMP DEFAULT now()
updated_at     TIMESTAMP DEFAULT now()
```

---

## Flujo de sesión multi-tenant

```
1. POST /whatsapp/sessions/start  (JWT requerido)
         ↓
2. SessionService crea registro DB { tenantId, status: PENDING }
         ↓
3. Baileys makeWASocket() → genera QR
         ↓
4. QR base64 → guardado en DB  +  emitido via WebSocket room:tenantId
   status → QR_READY
         ↓
5. Usuario escanea QR con teléfono WhatsApp
         ↓
6. connection.update = "open"
         ↓
7. auth_state (creds + keys) → AES encrypt → PostgreSQL
   status → CONNECTED
   phoneNumber → guardado
         ↓
8. Sesión vive en Map<tenantId, WASocket> (memoria)
   Reinicio del pod → carga auth_state desde PG → reconecta sin nuevo QR
```

### Estados y transiciones

```
         ┌─────────────────────────────────────────┐
         ↓                                         │
PENDING → QR_READY → CONNECTING → CONNECTED        │
                                      ↓            │
                               DISCONNECTED ────────┘  (auto-reconnect max 3)
                                      ↓
                                 LOGGED_OUT  (requiere nuevo QR)
```

**Seguridad sesiones:**
- `auth_state` (claves criptográficas de Baileys) → AES-256-CBC antes de persistir
- Guard por `tenantId` del JWT: un tenant no puede ver/usar sesión de otro
- QR expira en 60s si no se escanea → status vuelve a PENDING

---

## Endpoints completos

### Sessions — `/whatsapp/sessions`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/whatsapp/sessions/start` | JWT | Inicia sesión, retorna `{ qr: base64, status }` |
| GET | `/whatsapp/sessions/status` | JWT | Estado actual de la sesión del tenant |
| DELETE | `/whatsapp/sessions/logout` | JWT | Cierra sesión y borra auth_state |
| POST | `/whatsapp/sessions/reconnect` | JWT | Fuerza reconexión manual |

### Messaging — `/whatsapp/messages`

| Método | Ruta | Auth | Body | Descripción |
|---|---|---|---|---|
| POST | `/whatsapp/messages/text` | JWT | `{ to, text }` | Envía texto plano |
| POST | `/whatsapp/messages/image` | JWT | `{ to, url, caption? }` | Envía imagen por URL |
| POST | `/whatsapp/messages/audio` | JWT | `{ to, url }` | Envía audio por URL |
| POST | `/whatsapp/messages/video` | JWT | `{ to, url, caption? }` | Envía video por URL |
| POST | `/whatsapp/messages/document` | JWT | `{ to, url, filename, mimetype }` | Envía documento por URL |
| POST | `/whatsapp/messages/reply` | JWT | `{ to, text, quotedMessageId }` | Responde citando mensaje |
| POST | `/whatsapp/messages/reaction` | JWT | `{ to, messageId, emoji }` | Reacción emoji |
| POST | `/whatsapp/messages/bulk` | JWT | `{ messages: [{to, text}] }` | Masivo (1 msg/s rate-limit) |
| GET | `/whatsapp/messages/history/:jid` | JWT | query: `page, limit` | Historial paginado |

### Webhooks — `/whatsapp/webhooks`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/whatsapp/webhooks` | JWT | Registra URL webhook |
| GET | `/whatsapp/webhooks` | JWT | Lista webhooks del tenant |
| PATCH | `/whatsapp/webhooks/:id` | JWT | Actualiza URL/eventos/estado |
| DELETE | `/whatsapp/webhooks/:id` | JWT | Elimina webhook |

### AI Provider — `/whatsapp/ai`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/whatsapp/ai/provider` | JWT | Configura proveedor (token + modelo + prompt) |
| GET | `/whatsapp/ai/provider` | JWT | Obtiene configuración actual |
| PATCH | `/whatsapp/ai/provider` | JWT | Actualiza parcialmente |
| DELETE | `/whatsapp/ai/provider` | JWT | Elimina configuración |
| POST | `/whatsapp/ai/test` | JWT | Prueba con mensaje de texto |

### Otros

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | Ninguna | Health check |

---

## WebSocket (Socket.io)

```
URL:   ws://host:3000
Auth:  header Authorization: Bearer <jwt>  o  query ?token=<jwt>

Al conectar: cliente unido automáticamente a room de su tenantId

Eventos del servidor → cliente:
  session:qr           { tenantId, qr: string }
  session:connected    { tenantId, phoneNumber }
  session:disconnected { tenantId, reason }
  session:logged_out   { tenantId }
  message:received     { tenantId, jid, from, type, content, mediaUrl?, timestamp }
  message:sent         { tenantId, jid, messageId, status }
  message:status       { tenantId, messageId, status: DELIVERED | READ }

Eventos del cliente → servidor:
  ping                 → pong (heartbeat)
```

---

## AI Provider — diseño desacoplado

```typescript
// Interfaz única, cualquier proveedor la implementa
interface AiAdapter {
  chat(messages: AiMessage[], systemPrompt?: string): Promise<string>
}

// Factory selecciona implementación según config del tenant en DB
AiProviderFactory.create(config: AiProviderEntity): AiAdapter

// Implementaciones:
//   GeminiAdapter    → @google/generative-ai
//   OpenAiAdapter    → openai SDK
//   AnthropicAdapter → @anthropic-ai/sdk
//   CustomAdapter    → HTTP POST a base_url custom
```

### Auto-reply flow

```
message:received (INBOUND)
        ↓
IncomingService.process(tenantId, message)
        ↓
AiProviderRepository.findByTenant(tenantId)
  → si is_active && auto_reply:
        ↓
ConversationHistory (últimos 20 msgs) → AiAdapter.chat()
        ↓
MessagingService.sendText(tenantId, jid, aiResponse)
        ↓
message guardado en message_history (OUTBOUND, ai_processed=true)
```

---

## Auth — JWT

```
Header: Authorization: Bearer <token>
Claims esperados:
  sub       → userId
  tenantId  → mapea a sesión WhatsApp del tenant
  roles     → array de roles (para futura autorización granular)

Mismo JWT_SECRET e issuer que ferri-monolito.
```

**Webhook HMAC-SHA256:**
```
Header enviado: X-Ferri-Signature: sha256=<hmac_hex>
Body firmado: JSON.stringify(payload)
Secret: configurado por tenant al crear webhook
```

---

## Variables de entorno

```env
# App
PORT=3000
NODE_ENV=development

# PostgreSQL
PG_HOST=localhost
PG_PORT=5434
PG_USER=ferri_bot
PG_PASSWORD=ferri_bot_123
PG_DATABASE=ferri_bot_dev

# JWT (mismo que ferri-monolito)
JWT_SECRET=change_this_secret
JWT_ISSUER=ferridescuentos

# Encriptación AES (32 chars)
ENCRYPTION_KEY=change_this_32_char_key_here____

# Frontend (CORS)
FRONTEND_URL=http://localhost:4200
```

---

## Docker Compose (dev)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5434:5432"]   # 5434 para no colisionar con ferri-monolito (5433)
    environment:
      POSTGRES_USER: ferri_bot
      POSTGRES_PASSWORD: ferri_bot_123
      POSTGRES_DB: ferri_bot_dev

  ferri-bot:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres]
    environment: (variables del .env)
```

---

## Comandos de desarrollo

```bash
cd ferri-bot

# Infraestructura
docker compose -f docker-compose.dev.yml up postgres -d

# Dev
npm run start:dev

# Tests
npm test

# Build
npm run build
```

---

## Reglas del proyecto

1. `tenantId` siempre del JWT — nunca de query param ni body
2. `auth_state` de Baileys SIEMPRE AES-256 encriptado antes de guardar en DB
3. `MessagingModule` no accede a `SessionRepository` — solo via `SessionService`
4. AI completamente desacoplado — `IncomingService` no importa implementaciones AI directamente
5. Bulk: máximo 1 msg/segundo por tenant (sleep entre envíos)
6. Webhooks firmados con HMAC-SHA256 del body + secret del tenant
7. TypeORM `synchronize: true` solo en development — migrations en producción

---

## Estado actual

- [x] Planteamiento y decisiones de arquitectura
- [ ] Scaffold NestJS nuevo proyecto
- [ ] Instalar dependencias (Baileys, TypeORM, JWT, Socket.io, crypto-js)
- [ ] Config module (envs.ts + Joi)
- [ ] Database module (TypeORM PostgreSQL)
- [ ] Entidades: WhatsappSession, MessageHistory, WebhookSubscription, AiProvider
- [ ] Session module (Baileys multi-tenant + PostgreSQL auth state)
- [ ] Messaging module (todos los tipos)
- [ ] Incoming module (recepción + forward a webhooks/WS)
- [ ] WebSocket Gateway
- [ ] Webhook module
- [ ] AI Provider module (factory + adaptadores)
- [ ] JWT Auth Guard
- [ ] Docker Compose + .env.template
