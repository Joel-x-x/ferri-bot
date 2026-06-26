# Módulo: Rate Limiting (Clientes)

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

Un cliente puede abusar del bot: enviar cientos de mensajes, preguntas sin sentido, o intentar explotar el LLM. Esto cuesta tokens de IA y degrada el servicio. Necesitamos límites con advertencias progresivas.

## Audiencias

**Staff tiene límite alto (300/día)** — protección anti-abuso, no restricción de uso. Si un staff genera 300 mensajes IA en un día, algo anda mal.

**Clientes tienen límites más estrictos** — protección contra abuso por contactos desconocidos que cuestan tokens IA.

## Límites por audiencia

| Audiencia | Msg/día default | Configurable |
|-----------|----------------|-------------|
| Cliente no vinculado | 25 | Sí (`rate_limit_daily_default`) |
| Cliente vinculado | 50 (2x) | Sí (`rate_limit_linked_contact_multiplier`) |
| Staff | 300 | Sí (`rate_limit_daily_staff`) |

Anti-flood (hardcoded, no configurable): max 5 mensajes por minuto para cualquier contacto.

## Escalera de restricción (cliente no vinculado, 25 msg)

```
Mensaje 1-18 (por día)    → Normal
Mensaje 19-22             → Advertencia: "Estás cerca del límite diario"
Mensaje 23-25             → Advertencia fuerte: "Último aviso. Pocos mensajes restantes"
Mensaje 26+               → Bloqueo temporal (1 hora): "Has superado el límite. Intenta más tarde"
3 bloqueos en 24h         → Bloqueo extendido (24 horas)
Bloqueo extendido         → Alerta al desarrollador/admin
```

Los umbrales de warning se calculan proporcionales: warning a 70%, hard warning a 90%.

## Implementación

### Contador en Redis (no en DB)

```
Key: rate:{tenantId}:{phone}:daily
Value: contador de mensajes
TTL: 24 horas (reset automático a medianoche)

Key: rate:{tenantId}:{phone}:blocked
Value: timestamp de desbloqueo
TTL: duración del bloqueo
```

¿Por qué Redis y no DB?
- Lecturas/escrituras por cada mensaje — necesita ser rápido
- TTL automático — limpieza gratis
- Si Redis cae, peor caso = no hay rate limiting (fail open, no fail closed)

### Sin Redis (alternativa simple para MVP)

Si no hay Redis disponible, usar tabla en DB con limpieza periódica:

```sql
CREATE TABLE rate_limits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  VARCHAR(100) NOT NULL,
  phone      VARCHAR(20) NOT NULL,
  msg_count  INTEGER DEFAULT 0,
  blocked_until TIMESTAMP,
  window_start TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);
```

Job cada hora: `DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '24 hours' AND blocked_until IS NULL`.

### Check en IncomingService

```typescript
// incoming.service.ts — antes de processAiReply()
const rateCheck = await rateLimitService.check(tenantId, from, isStaff);

switch (rateCheck.status) {
  case 'OK':
    break;
  case 'WARNING':
    // Agregar nota al system prompt: "El usuario está cerca del límite"
    break;
  case 'SOFT_BLOCK':
    await sendMessage(from, rateCheck.message);
    return; // No procesar con IA
  case 'HARD_BLOCK':
    await alertService.notifyDev(tenantId, from, 'rate_limit_exceeded');
    return; // Silencio total
}
```

> `rateLimitService.check()` resuelve el límite según audiencia: staff (300), vinculado (50), no vinculado (25).

## Configuración por tenant (vía SaaS Config)

Todos los valores configurables en `saas_config` / `tenant_config` (ver módulo 12):

| Key | Default | Descripción |
|-----|---------|-------------|
| `rate_limit_daily_default` | 25 | Msg/día para clientes no vinculados |
| `rate_limit_daily_staff` | 300 | Msg/día para staff |
| `rate_limit_linked_contact_multiplier` | 2 | Multiplicador para vinculados (2x = 50/día) |
| `rate_limit_block_minutes` | 60 | Duración bloqueo temporal |
| `rate_limit_max_blocks_before_extended` | 3 | Bloqueos antes de bloqueo extendido (24h) |

Cada tenant puede ajustar dentro de los rangos definidos por SuperAdmin.

## Alertas al desarrollador

Comportamientos que disparan alerta:

| Comportamiento | Alerta |
|---------------|--------|
| 3+ bloqueos en 24h del mismo contacto | Rate limit abuse |
| Mensajes con patrones de prompt injection | Security alert |
| Contacto envía >10 mensajes en 1 minuto (spam) | Spam detection |
| Mensajes en idioma diferente al configurado + patrones sospechosos | Anomaly |

Canal de alerta: mensaje WhatsApp al `salesPhone` del tenant + webhook configurable (Slack, Discord, email).

## Decisiones resueltas

- [x] **Límites por defecto** → 25/día no vinculado, 50/día vinculado (2x), 300/día staff. Todos configurables por tenant
- [x] **Rate por hora** → No. Solo anti-flood hardcoded: max 5 msg/min
- [x] **Vinculado tiene más límite** → Sí, multiplicador 2x (configurable)
- [x] **Redis o DB** → DB para MVP (`rate_limits` table). Redis cuando haya infra
