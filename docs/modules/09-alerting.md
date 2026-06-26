# Módulo: Alerting / Monitoreo

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

El bot opera 24/7 sin supervisión. Si algo falla o un contacto tiene comportamiento sospechoso, nadie se entera hasta que es tarde.

## Tipos de alerta

### 1. Operacionales (sistema)

| Evento | Severidad | Acción |
|--------|----------|--------|
| LLM API no responde (3 intentos fallidos) | 🔴 Crítica | Notificar dev + activar respuesta fallback |
| Meta API webhook no entrega mensajes | 🔴 Crítica | Notificar dev |
| Latencia de respuesta >15s | 🟡 Warning | Log + notificar si persiste >5 min |
| Error en tool execution | 🟡 Warning | Log con contexto completo |
| ferri-monolito no responde (ERP) | 🟡 Warning | Notificar dev + respuesta degradada al staff |

### 2. De negocio (comportamiento)

| Evento | Severidad | Acción |
|--------|----------|--------|
| Contacto bloqueado por rate limit (3ra vez) | 🟡 Warning | Notificar admin del tenant |
| Patrón de prompt injection detectado | 🔴 Crítica | Bloquear + notificar dev |
| Handoff sin respuesta del staff >30 min | 🟡 Warning | Re-notificar staff + escalar |
| Contacto reporta error del bot repetidamente | 🟡 Warning | Notificar dev con contexto |
| Flujo con estado expirado (timeout) | ℹ️ Info | Log para métricas |

### 3. De seguridad

| Evento | Severidad | Acción |
|--------|----------|--------|
| Intento de acceder a datos de otro tenant | 🔴 Crítica | Bloquear + notificar dev |
| Staff phone registrado con número sospechoso | 🟡 Warning | Notificar admin |
| Volumen anómalo de mensajes desde un tenant | 🟡 Warning | Notificar dev |

## Canales de notificación

```
Alerta generada
  │
  ├─ Severidad Crítica
  │    ├─ WhatsApp al developer (número configurado globalmente)
  │    ├─ Webhook HTTP (Slack, Discord, PagerDuty — configurable)
  │    └─ Log estructurado (para CloudWatch/Stackdriver)
  │
  ├─ Severidad Warning
  │    ├─ WhatsApp al salesPhone del tenant (si es de negocio)
  │    ├─ Webhook HTTP (si configurado)
  │    └─ Log estructurado
  │
  └─ Severidad Info
       └─ Solo log estructurado
```

## Implementación

### AlertService

```typescript
@Injectable()
export class AlertService {
  async alert(params: {
    tenantId: string;
    severity: 'critical' | 'warning' | 'info';
    type: string;          // 'rate_limit' | 'api_error' | 'prompt_injection' | ...
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    // 1. Log estructurado siempre
    this.logger.log({ level: params.severity, ...params });

    // 2. WhatsApp si severity >= warning
    if (params.severity !== 'info') {
      const recipient = params.severity === 'critical'
        ? this.config.devPhone
        : await this.getAdminPhone(params.tenantId);

      await this.messagingService.sendText(recipient, formatAlert(params));
    }

    // 3. Webhook si configurado
    await this.webhookService.dispatch(params.tenantId, 'alert', params);
  }
}
```

### Detección de prompt injection (básica)

```typescript
const INJECTION_PATTERNS = [
  /ignore.*previous.*instructions/i,
  /you are now/i,
  /forget.*everything/i,
  /system.*prompt/i,
  /reveal.*instructions/i,
  /act as/i,
];

function detectInjection(content: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(content));
}
```

**Nota:** Esto es detección básica por regex. El LLM tiene sus propias defensas en el system prompt. Doble barrera.

## Configuración

```sql
-- En tabla tenant_config o ai_providers
alert_dev_phone:     VARCHAR(20),     -- número del desarrollador
alert_webhook_url:   VARCHAR(500),    -- webhook para alertas (Slack, etc.)
alert_min_severity:  VARCHAR(20) DEFAULT 'warning'  -- mínimo para webhook
```

## Modelo de datos

### `conversation_events` — historial de eventos de una conversación

```sql
CREATE TABLE conversation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  conversation_id UUID NOT NULL,          -- FK a conversations
  event_type      VARCHAR(50) NOT NULL,   -- 'opened', 'resolved', 'handoff', 'rate_limit_block',
                                          -- 'flow_started', 'flow_completed', 'flow_expired',
                                          -- 'session_started', 'injection_detected'
  metadata        JSONB DEFAULT '{}',     -- datos extra según tipo
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_conv_events_conversation ON conversation_events(conversation_id);
CREATE INDEX idx_conv_events_tenant_type ON conversation_events(tenant_id, event_type);
```

### `system_alerts` — feed operativo para admin/dev

```sql
CREATE TABLE system_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,                       -- null para alertas globales (infra)
  severity    VARCHAR(20) NOT NULL,       -- 'critical', 'warning', 'info'
  alert_type  VARCHAR(50) NOT NULL,       -- 'api_error', 'injection', 'high_latency',
                                          -- 'rate_limit_abuse', 'webhook_failure'
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',         -- contexto: phone, error, latency_ms, etc.
  notified    BOOLEAN DEFAULT FALSE,      -- ya se envió notificación
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_system_alerts_tenant ON system_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity, created_at DESC);
```

### Relación entre tablas

| Evento | conversation_events | system_alerts |
|--------|:------------------:|:------------:|
| Conversación abierta/resuelta | ✅ | — |
| Handoff sin respuesta | ✅ | ✅ (warning) |
| Rate limit block | ✅ | ✅ (si 3+) |
| Prompt injection | ✅ | ✅ (critical) |
| LLM API caída | — | ✅ (critical) |
| Alta latencia | — | ✅ (warning) |
| Flujo expirado | ✅ | — |

## Decisiones resueltas

- [x] **Rate de alertas** → Max 1 del mismo tipo cada 15 min (configurable: `alert_rate_limit_minutes`)
- [x] **Dashboard web** → No para MVP. Solo WhatsApp + logs estructurados
- [x] **Alertas vs conversation_events** → Son tablas separadas con overlap:
  - `conversation_events` = historial de una conversación específica (opened, resolved, handoff, rate_limit_block)
  - `system_alerts` = feed operativo para admin/dev (api_error, injection, high_latency)
  - Cuando un evento es ambos (ej: rate_limit_block), se guarda en AMBAS tablas
