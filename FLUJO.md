# ferri-bot — Flujo de Endpoints

Base URL: `http://localhost:3000/api/v1`  
Swagger UI: `http://localhost:3000/docs`  
Auth: `Authorization: Bearer <jwt>` en todos los endpoints (excepto indicado)

---

## Generar JWT de prueba

```bash
node -e "
require('./node_modules/dotenv').config({ path: '.env', override: true });
const jwt = require('./node_modules/jsonwebtoken');
console.log(jwt.sign(
  { sub: 'user-001', tenantId: 'tenant-001', roles: ['ADMIN'] },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
));
" 2>/dev/null
```

> `tenantId` del JWT identifica la sesión WhatsApp. Cada tenant tiene su propia sesión aislada.

---

## 1. Sessions — `/whatsapp/sessions`

Gestión del ciclo de vida de la sesión WhatsApp por tenant.

### Estados posibles

```
PENDING → QR_READY → CONNECTING → CONNECTED
                                       ↓
                                DISCONNECTED ← auto-reconnect (max 3)
                                       ↓
                                  LOGGED_OUT
```

---

### `POST /whatsapp/sessions/start`
Inicia una sesión WhatsApp. Si ya está CONNECTED retorna ese estado. Si no, genera QR.

**Request**
```http
POST /api/v1/whatsapp/sessions/start
Authorization: Bearer <jwt>
```
*(Sin body)*

**Response — QR generado**
```json
{
  "qr": "data:image/png;base64,iVBORw0KGgo...",
  "status": "QR_READY"
}
```

**Response — Ya conectado**
```json
{
  "status": "CONNECTED"
}
```

> El QR también se emite por WebSocket en el evento `session:qr`.  
> Expira en ~60 segundos. Si no se escanea, vuelve a `PENDING`.

---

### `GET /whatsapp/sessions/status`
Estado actual de la sesión del tenant.

**Request**
```http
GET /api/v1/whatsapp/sessions/status
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "id": "4f1b2c37-1418-447e-82d4-dde13f99238b",
  "tenantId": "tenant-001",
  "status": "CONNECTED",
  "phoneNumber": "593960801963",
  "qrCode": null,
  "reconnectCount": 0,
  "createdAt": "2026-05-03T06:48:12.710Z",
  "updatedAt": "2026-05-03T06:55:43.984Z"
}
```

---

### `POST /whatsapp/sessions/reconnect`
Fuerza reconexión manual (cierra socket actual y reconecta con auth guardada).

**Request**
```http
POST /api/v1/whatsapp/sessions/reconnect
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "status": "CONNECTING"
}
```

---

### `DELETE /whatsapp/sessions/logout`
Cierra sesión, borra auth_state de la DB. Requiere nuevo QR para reconectar.

**Request**
```http
DELETE /api/v1/whatsapp/sessions/logout
Authorization: Bearer <jwt>
```

**Response:** `204 No Content`

---

## 2. Messages — `/whatsapp/messages`

Todos los endpoints retornan `{ "messageId": "3EB0..." }` al enviar exitosamente.  
El campo `to` acepta número con o sin sufijo:
- `593960801963` → se normaliza a `593960801963@s.whatsapp.net`
- `593960801963@s.whatsapp.net` → se usa directamente
- `120363000000@g.us` → grupo

---

### `POST /whatsapp/messages/text`
Envía mensaje de texto plano.

**Request**
```json
{
  "to": "593960801963",
  "text": "Hola! Tu pedido #1234 está listo 🎉"
}
```

**Response**
```json
{
  "messageId": "3EB02E2C37521D6C06E7B8"
}
```

---

### `POST /whatsapp/messages/image`
Envía imagen desde URL externa.

**Request**
```json
{
  "to": "593960801963",
  "url": "https://ejemplo.com/producto.jpg",
  "caption": "Producto en stock — $29.99"
}
```

**Response**
```json
{
  "messageId": "3EB0A1B2C3D4E5F6A7B8"
}
```

> `caption` es opcional.

---

### `POST /whatsapp/messages/audio`
Envía audio desde URL externa.

**Request**
```json
{
  "to": "593960801963",
  "url": "https://ejemplo.com/nota-de-voz.mp3",
  "ptt": true
}
```

**Response**
```json
{
  "messageId": "3EB0C1D2E3F4A5B6C7D8"
}
```

> `ptt: true` → se muestra como nota de voz (push-to-talk). `ptt: false` → archivo de audio normal.

---

### `POST /whatsapp/messages/video`
Envía video desde URL externa.

**Request**
```json
{
  "to": "593960801963",
  "url": "https://ejemplo.com/demo.mp4",
  "caption": "Demo del producto"
}
```

**Response**
```json
{
  "messageId": "3EB0D1E2F3A4B5C6D7E8"
}
```

---

### `POST /whatsapp/messages/document`
Envía documento (PDF, Excel, Word, etc.) desde URL externa.

**Request**
```json
{
  "to": "593960801963",
  "url": "https://ejemplo.com/factura-001.pdf",
  "filename": "Factura-001.pdf",
  "mimetype": "application/pdf"
}
```

**Response**
```json
{
  "messageId": "3EB0E1F2A3B4C5D6E7F8"
}
```

> `mimetype` comunes: `application/pdf`, `application/vnd.ms-excel`, `application/msword`, `text/plain`

---

### `POST /whatsapp/messages/reply`
Responde citando un mensaje previo (aparece con la cita en el chat).

**Request**
```json
{
  "to": "593960801963",
  "text": "Claro! Te enviamos el tracking en 5 minutos.",
  "quotedMessageId": "3EB02E2C37521D6C06E7B8"
}
```

**Response**
```json
{
  "messageId": "3EB0F1A2B3C4D5E6F7A8"
}
```

---

### `POST /whatsapp/messages/reaction`
Reacciona a un mensaje con emoji.

**Request**
```json
{
  "to": "593960801963",
  "messageId": "3EB02E2C37521D6C06E7B8",
  "emoji": "👍"
}
```

**Response**
```json
{
  "messageId": "3EB0A2B3C4D5E6F7A8B9"
}
```

---

### `POST /whatsapp/messages/bulk`
Envío masivo con rate-limit de 1 mensaje/segundo. Máximo 100 mensajes por llamada.

**Request**
```json
{
  "messages": [
    { "to": "593960801963", "text": "Hola Juan! Tenemos una oferta especial para ti." },
    { "to": "593970123456", "text": "Hola María! Tu pedido está en camino." },
    { "to": "593980654321", "text": "Hola Carlos! Recuerda tu cita mañana a las 10am." }
  ]
}
```

**Response**
```json
{
  "sent": 3,
  "failed": 0
}
```

---

### `GET /whatsapp/messages/history/:jid`
Historial de mensajes (enviados y recibidos) con un contacto, paginado.

**Request**
```http
GET /api/v1/whatsapp/messages/history/593960801963?page=1&limit=20
Authorization: Bearer <jwt>
```

**Response**
```json
{
  "data": [
    {
      "id": "uuid-aqui",
      "tenantId": "tenant-001",
      "jid": "593960801963@s.whatsapp.net",
      "messageId": "3EB02E2C37521D6C06E7B8",
      "direction": "OUTBOUND",
      "type": "TEXT",
      "content": "Hola! Tu pedido #1234 está listo 🎉",
      "mediaUrl": null,
      "quotedMessageId": null,
      "status": "SENT",
      "aiProcessed": false,
      "createdAt": "2026-05-03T07:00:00.000Z"
    },
    {
      "id": "uuid-aqui-2",
      "tenantId": "tenant-001",
      "jid": "593960801963@s.whatsapp.net",
      "messageId": "3EB0INBOUND001",
      "direction": "INBOUND",
      "type": "TEXT",
      "content": "Gracias! ¿Cuándo llega?",
      "mediaUrl": null,
      "quotedMessageId": null,
      "status": "READ",
      "aiProcessed": false,
      "createdAt": "2026-05-03T07:01:30.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20
}
```

> Query params: `page` (default 1), `limit` (default 20). Ordenado por `createdAt DESC`.

---

## 3. Webhooks — `/whatsapp/webhooks`

Registra URLs externas para recibir eventos en tiempo real vía HTTP POST.  
Los payloads se firman con HMAC-SHA256 en el header `X-Ferri-Signature: sha256=<hex>`.

### Eventos disponibles

| Evento | Cuándo se dispara |
|---|---|
| `message.received` | Mensaje entrante de cualquier contacto |
| `message.sent` | Mensaje enviado exitosamente |
| `message.status` | Cambio de estado (DELIVERED / READ) |
| `session.connected` | Sesión conectada tras escanear QR |
| `session.disconnected` | Sesión desconectada (reintentando) |
| `session.qr` | QR generado (útil para mostrar en frontend) |
| `session.logged_out` | Sesión cerrada definitivamente |

---

### `POST /whatsapp/webhooks`
Registra nuevo webhook.

**Request**
```json
{
  "url": "https://mi-backend.com/webhooks/whatsapp",
  "events": ["message.received", "message.sent"],
  "secret": "mi-secreto-hmac-opcional"
}
```

**Response `201 Created`**
```json
{
  "id": "uuid-webhook",
  "tenantId": "tenant-001",
  "url": "https://mi-backend.com/webhooks/whatsapp",
  "events": ["message.received", "message.sent"],
  "secret": "mi-secreto-hmac-opcional",
  "isActive": true,
  "createdAt": "2026-05-03T07:00:00.000Z",
  "updatedAt": "2026-05-03T07:00:00.000Z"
}
```

---

### `GET /whatsapp/webhooks`
Lista todos los webhooks del tenant.

**Response**
```json
[
  {
    "id": "uuid-webhook",
    "url": "https://mi-backend.com/webhooks/whatsapp",
    "events": ["message.received", "message.sent"],
    "isActive": true,
    "createdAt": "2026-05-03T07:00:00.000Z"
  }
]
```

---

### `PATCH /whatsapp/webhooks/:id`
Actualiza URL, eventos activos o estado del webhook.

**Request**
```json
{
  "events": ["message.received", "message.sent", "session.connected"],
  "isActive": false
}
```

**Response** — objeto webhook actualizado.

---

### `DELETE /whatsapp/webhooks/:id`
Elimina webhook.

**Response:** `204 No Content`

---

### Payload que recibe tu URL externa

```json
{
  "event": "message.received",
  "data": {
    "tenantId": "tenant-001",
    "jid": "593960801963@s.whatsapp.net",
    "from": "593960801963@s.whatsapp.net",
    "messageId": "3EB0INBOUND001",
    "type": "TEXT",
    "content": "Hola, necesito ayuda",
    "mediaUrl": null,
    "timestamp": 1746252000
  },
  "timestamp": "2026-05-03T07:05:00.000Z"
}
```

**Verificar firma HMAC en tu backend:**
```javascript
const crypto = require('crypto');
const signature = req.headers['x-ferri-signature']; // "sha256=abc123..."
const expected = 'sha256=' + crypto
  .createHmac('sha256', 'mi-secreto-hmac-opcional')
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expected) return res.status(401).send('Invalid signature');
```

---

## 4. AI Provider — `/whatsapp/ai`

Configura el proveedor de IA por tenant. Cuando `autoReply: true`, el bot responde automáticamente cualquier mensaje entrante usando el historial de conversación (últimos 20 mensajes).

### Proveedores soportados

| `provider` | Modelos ejemplo |
|---|---|
| `GEMINI` | `gemini-1.5-flash`, `gemini-1.5-pro` |
| `OPENAI` | `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo` |
| `ANTHROPIC` | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6` |
| `CUSTOM` | cualquier modelo (requiere `baseUrl`) |

---

### `POST /whatsapp/ai/provider`
Crea o actualiza configuración de IA (upsert).

**Request — Gemini**
```json
{
  "provider": "GEMINI",
  "apiKey": "AIzaSy...",
  "model": "gemini-1.5-flash",
  "systemPrompt": "Eres un asistente de ferretería. Responde solo preguntas sobre productos y pedidos. Sé amable y conciso.",
  "autoReply": true,
  "isActive": true
}
```

**Request — OpenAI**
```json
{
  "provider": "OPENAI",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini",
  "systemPrompt": "Eres el asistente de soporte de FerriDescuentos.",
  "autoReply": false,
  "isActive": true
}
```

**Request — Anthropic**
```json
{
  "provider": "ANTHROPIC",
  "apiKey": "sk-ant-...",
  "model": "claude-haiku-4-5-20251001",
  "systemPrompt": "Asistente de ventas. Responde en español. Máximo 2 oraciones por respuesta.",
  "autoReply": true,
  "isActive": true
}
```

**Request — Custom (cualquier API compatible)**
```json
{
  "provider": "CUSTOM",
  "apiKey": "tu-api-key",
  "model": "mi-modelo",
  "baseUrl": "https://mi-llm.com/api",
  "systemPrompt": "Eres un asistente.",
  "autoReply": false,
  "isActive": true
}
```

**Response** — configuración guardada (sin `apiKey` por seguridad)
```json
{
  "id": "uuid-ai",
  "tenantId": "tenant-001",
  "provider": "GEMINI",
  "model": "gemini-1.5-flash",
  "systemPrompt": "Eres un asistente de ferretería...",
  "baseUrl": null,
  "isActive": true,
  "autoReply": true,
  "createdAt": "2026-05-03T07:00:00.000Z",
  "updatedAt": "2026-05-03T07:00:00.000Z"
}
```

---

### `GET /whatsapp/ai/provider`
Obtiene configuración actual (sin `apiKey`).

**Response** — igual al objeto de arriba, o `null` si no hay proveedor configurado.

---

### `PATCH /whatsapp/ai/provider`
Actualiza campos específicos sin reescribir todo.

**Request — Solo cambiar system prompt y activar auto-reply**
```json
{
  "systemPrompt": "Nuevo prompt más específico.",
  "autoReply": true
}
```

**Request — Cambiar API key**
```json
{
  "apiKey": "AIzaSy-nueva-key..."
}
```

**Response** — configuración actualizada.

---

### `DELETE /whatsapp/ai/provider`
Elimina configuración de IA del tenant.

**Response:** `204 No Content`

---

### `POST /whatsapp/ai/test`
Prueba el proveedor configurado con un mensaje de texto.

**Request**
```json
{
  "message": "Hola, ¿tienen tornillos de 1/2 pulgada en stock?"
}
```

**Response**
```json
{
  "response": "Sí, contamos con tornillos de 1/2 pulgada en varias presentaciones: punta fina, cabeza hexagonal y autorroscantes. ¿Te gustaría conocer precios o disponibilidad?"
}
```

---

## 5. WebSocket — Socket.io

Conexión en tiempo real para recibir eventos sin polling.

**Conectar:**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer eyJhbGci...' }
  // alternativa: headers: { authorization: 'Bearer ...' }
});

socket.on('connect', () => console.log('Conectado al room del tenant'));
```

**Eventos del servidor → cliente:**

```javascript
// QR generado (para mostrar en frontend)
socket.on('session:qr', ({ tenantId, qr }) => {
  document.getElementById('qr-img').src = qr; // base64 PNG
});

// Sesión conectada
socket.on('session:connected', ({ tenantId, phoneNumber }) => {
  console.log('WhatsApp conectado:', phoneNumber);
});

// Sesión desconectada (reintentando)
socket.on('session:disconnected', ({ tenantId, reason, attempt }) => {
  console.warn('Desconectado, intento:', attempt);
});

// Sesión cerrada (requiere nuevo QR)
socket.on('session:logged_out', ({ tenantId }) => {
  console.error('Sesión cerrada. Escanear nuevo QR.');
});

// Mensaje entrante
socket.on('message:received', ({ tenantId, jid, from, type, content, mediaUrl, timestamp }) => {
  console.log(`Nuevo mensaje de ${from}: ${content}`);
});

// Mensaje enviado
socket.on('message:sent', ({ tenantId, jid, messageId, status }) => {
  console.log('Enviado:', messageId);
});

// Cambio de estado (entregado / leído)
socket.on('message:status', ({ tenantId, messageId, status }) => {
  // status: 'DELIVERED' | 'READ'
  updateMessageTick(messageId, status);
});
```

---

## 6. Flujo completo — ejemplo de uso

### Caso: Bot de soporte automático

```
1. POST /whatsapp/sessions/start
   → Recibo QR → lo muestro en mi frontend via WebSocket session:qr
   → Usuario escanea → session:connected llega

2. POST /whatsapp/ai/provider
   → Configuro Gemini con prompt de soporte
   → autoReply: true

3. Cliente escribe al número de WhatsApp
   → message:received llega por WebSocket + webhook POST a mi URL
   → AI responde automáticamente
   → message:sent confirma envío

4. GET /whatsapp/messages/history/593960801963
   → Veo todo el historial en PostgreSQL
```

### Caso: Notificaciones de pedidos (no auto-reply)

```
1. POST /whatsapp/sessions/start → conectar

2. POST /whatsapp/messages/text
   { "to": "593960801963", "text": "Tu pedido #1234 fue confirmado ✅" }

3. POST /whatsapp/messages/document
   { "to": "593960801963", "url": "https://s3.../factura.pdf",
     "filename": "Factura-1234.pdf", "mimetype": "application/pdf" }

4. Cuando cliente responde → message:received llega por WebSocket
   → Mi sistema decide si responder manualmente o con IA
```

---

## Códigos de error comunes

| HTTP | Mensaje | Causa |
|---|---|---|
| `401` | Missing token | No enviaste `Authorization: Bearer` |
| `401` | Invalid or expired token | JWT incorrecto o expirado |
| `404` | Session not found | Tenant no tiene sesión iniciada |
| `404` | No active session | Sesión existe en DB pero socket no activo (reconectar) |
| `400` | Validation error | Body inválido (campo faltante o formato incorrecto) |

---

## Variables de entorno clave

```env
PORT=3000
PG_HOST=localhost
PG_PORT=5434
JWT_SECRET=...          # mismo que ferri-monolito en producción
ENCRYPTION_KEY=...      # 32 chars — encripta auth_state de Baileys y API keys de AI
```
