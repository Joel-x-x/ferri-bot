# Módulo: SaaS Config (SuperAdmin + Tenant Overrides)

Estado: **Tablas creadas** | Fecha: 2026-06-25

---

## Concepto

Configuración en cascada de 3 niveles:

```
SuperAdmin (saas_config)     → defaults globales + min/max
  └─ Tenant Admin (tenant_config) → overrides dentro de rangos
       └─ Código (hardcoded)       → fallback si no hay config
```

Resolución: `tenant_config[key] ?? saas_config[key] ?? hardcoded_default`

## Tablas implementadas

### `saas_config` — Defaults globales

```sql
CREATE TABLE saas_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    data_type   VARCHAR(20) NOT NULL DEFAULT 'STRING',  -- STRING, INTEGER, BOOLEAN, DURATION
    min_value   TEXT,          -- min para validar override de tenant
    max_value   TEXT,          -- max para validar override de tenant
    description VARCHAR(255),
    updated_at  TIMESTAMP DEFAULT now(),
    updated_by  UUID
);
```

### `tenant_config` — Overrides por tenant

```sql
CREATE TABLE tenant_config (
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    key         VARCHAR(100) NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMP DEFAULT now(),
    updated_by  UUID,
    PRIMARY KEY (tenant_id, key)
);
```

## Migraciones

- `V801__create_saas_config.sql` — crea ambas tablas
- `V802__seed_saas_config_defaults.sql` — seed con 32 valores por defecto

## Valores por defecto (seed)

### Auth & Sessions
| Key | Default | Min | Max | Descripción |
|-----|---------|-----|-----|-------------|
| `staff_session_ttl_hours` | 168 (7d) | 1 | 720 (30d) | TTL sesión staff |
| `customer_session_ttl_hours` | 24 | 1 | 168 (7d) | TTL sesión cliente |
| `otp_max_attempts` | 3 | 1 | 10 | Intentos OTP antes de lockout |
| `otp_lockout_minutes` | 10 | 5 | 60 | Duración lockout OTP |
| `otp_expiry_minutes` | 5 | 1 | 15 | Expiración código OTP |
| `session_validation_cache_minutes` | 5 | 1 | 30 | Cache validación sesión |

### Media Processing
| Key | Default | Min | Max | Descripción |
|-----|---------|-----|-----|-------------|
| `audio_max_duration_seconds` | 1800 (30m) | 10 | 3600 (1h) | Duración máx audio para STT |
| `audio_stt_enabled` | true | — | — | Habilitar Speech-to-Text |
| `image_vision_enabled` | true | — | — | Habilitar LLM Vision para imágenes |
| `image_ocr_confirmation_required` | true | — | — | Confirmar antes de actuar sobre OCR |
| `stt_provider` | groq | — | — | Proveedor STT: groq, openai, google, deepgram |
| `stt_fallback_provider` | openai | — | — | Fallback si proveedor primario falla |

### Rate Limiting
| Key | Default | Min | Max | Descripción |
|-----|---------|-----|-----|-------------|
| `rate_limit_daily_default` | 25 | 10 | 500 | Msg/día para clientes no vinculados |
| `rate_limit_daily_staff` | 300 | 50 | 1000 | Msg/día para staff |
| `rate_limit_linked_contact_multiplier` | 2 | 1 | 5 | Multiplicador para vinculados (2x = 50/día) |
| `rate_limit_block_minutes` | 60 | 10 | 1440 | Bloqueo temporal tras exceder límite |
| `rate_limit_max_blocks_before_extended` | 3 | 1 | 10 | Bloqueos antes de bloqueo extendido (24h) |

### AI / LLM
| Key | Default | Min | Max |
|-----|---------|-----|-----|
| `max_tool_rounds` | 5 | 1 | 15 |
| `conversation_context_messages` | 20 | 5 | 50 |
| `max_response_length` | 4000 | 500 | 4096 |
| `tenant_prompt_max_length` | 2000 | 100 | 5000 |

### Security
| Key | Default | Min | Max |
|-----|---------|-----|-----|
| `injection_block_duration_minutes` | 60 | 10 | 1440 |
| `injection_max_blocks_before_extended` | 3 | 1 | 10 |
| `output_filter_enabled` | true | — | — |
| `input_max_length` | 2000 | 100 | 5000 |

### Alerting
| Key | Default | Min | Max |
|-----|---------|-----|-----|
| `alert_rate_limit_minutes` | 15 | 5 | 60 |
| `alert_min_severity` | warning | — | — |

### Conversations & Flows
| Key | Default | Min | Max |
|-----|---------|-----|-----|
| `flow_default_expiry_minutes` | 15 | 5 | 60 |
| `auto_resolve_inactivity_hours` | 24 | 1 | 168 |
| `welcome_message_enabled` | true | — | — |

### AI Memory
| Key | Default | Min | Max | Descripción |
|-----|---------|-----|-----|-------------|
| `contact_memory_enabled` | true | — | — | Habilitar memoria de contactos |
| `contact_memory_max_size_bytes` | 2048 | 512 | 8192 | Tamaño máximo JSONB por contacto |
| `contact_memory_prompt_max_chars` | 400 | 100 | 1000 | Chars máx inyectados al system prompt |
| `cheque_reminder_days` | 5,3,1 | — | — | Días antes de vencimiento para recordatorio |

> **Nota:** La memoria NO expira. Se actualiza naturalmente cuando el contacto interactúa. Borrado solo manual ("olvídame").

## Pendiente

- [ ] Endpoint CRUD para SuperAdmin (leer/actualizar `saas_config`)
- [ ] Endpoint para Tenant Admin (leer/actualizar `tenant_config`)
- [ ] Service Java con cascade: `getConfig(tenantId, key) → tenant ?? global ?? default`
- [ ] Cache Caffeine de config (TTL 5 min)
- [ ] Validación de min/max al guardar tenant override
- [ ] UI web para gestión de config
