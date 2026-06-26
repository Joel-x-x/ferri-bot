# Módulo: Autenticación y Sesiones WhatsApp

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

Hoy ferri-bot usa API Key para todas las llamadas a ferri-monolito. Esto significa:
- No hay identidad de usuario real — todo es `service@internal`
- Auditoría ciega: no se sabe QUIÉN creó una factura o registró un cheque
- Las authorities se pasan como dato, no se verifican por el monolito
- Clientes no pueden consultar SUS facturas/pedidos (no hay "su")

## Decisión: JWT por usuario, como la web

Staff y clientes se autentican por WhatsApp y obtienen JWT real. El bot llama al monolito con el JWT del usuario — mismos endpoints, misma autorización, misma auditoría.

API Key se mantiene solo para operaciones sin usuario: notificaciones push, batch jobs, health checks.

---

## Flujos de autenticación

### Staff: Google OAuth o OTP por email

```
Staff escribe primer mensaje (o sesión expirada)
  │
  Bot: "Para acceder como staff, elige cómo verificarte:"
  [🔗 Iniciar con Google]  [📧 Código por email]
  │
  ├─ Google OAuth:
  │    Bot envía CTA button → https://app.ferridescuentos.com/auth/wa-link?phone=593...&nonce=abc
  │    Staff abre → Google OAuth → monolito genera JWT
  │    → monolito guarda en wa_sessions
  │    → monolito notifica a ferri-bot: POST /whatsapp/sessions/confirm
  │    → Bot: "✅ Verificado como María (Cajera)"
  │
  └─ OTP por email:
       Bot: "Enviando código a m***a@ferreteria.com..."
       → monolito genera OTP 6 dígitos, envía por email
       Staff: "482916"
       → Bot valida OTP con monolito → recibe JWT
       → Bot: "✅ Verificado como María (Cajera)"
```

### Cliente: Google OAuth, OTP, o Cédula/RUC

Solo se pide cuando necesita operación transaccional (facturas, pedidos, pagos). Consultas de catálogo son libres.

```
Cliente: "Quiero ver mis facturas"
  │
  Bot: "Para ver tus facturas necesito verificar tu identidad:"
  [🔗 Iniciar con Google]  [📧 Código por email]  [🆔 Cédula/RUC]
  │
  ├─ Google OAuth / OTP: mismo flujo que staff
  │
  └─ Cédula/RUC:
       Bot: "Ingresa tu cédula o RUC:"
       Cliente: "1712345678"
       → Monolito busca profile por identificación
       → OTP enviado al email/teléfono registrado del profile
       Cliente confirma OTP → JWT con role CUSTOMER
```

---

## Modelo de sesiones

### Tabla en ferri-monolito

```sql
CREATE TABLE wa_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id),
    phone       VARCHAR(20) NOT NULL,
    token_id    VARCHAR(100) NOT NULL UNIQUE,   -- jti del JWT, para invalidar
    channel     VARCHAR(20) DEFAULT 'whatsapp',
    valid       BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    expires_at  TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, phone, channel)
);
CREATE INDEX idx_wa_sessions_user ON wa_sessions(user_id);
CREATE INDEX idx_wa_sessions_token ON wa_sessions(token_id);
```

### TTL configurable por tenant

| Audiencia | Default | Rango permitido |
|-----------|---------|----------------|
| Staff | 7 días (168h) | 1h — 30 días |
| Cliente | 24 horas | 1h — 7 días |

```sql
-- En tenant_config
staff_session_ttl_hours:    INTEGER DEFAULT 168,
customer_session_ttl_hours: INTEGER DEFAULT 24
```

### Almacenamiento en ferri-bot

JWT cifrado (AES) en la tabla `conversations`:

```sql
ALTER TABLE conversations ADD COLUMN session_token TEXT;           -- JWT cifrado
ALTER TABLE conversations ADD COLUMN session_token_id VARCHAR(100); -- jti para validar
ALTER TABLE conversations ADD COLUMN session_expires_at TIMESTAMP;
ALTER TABLE conversations ADD COLUMN session_user_id UUID;
```

### Validación por mensaje

```
Staff envía mensaje
  │
  ├─ conversations.session_token presente?
  │    ├─ NO → flujo de login
  │    └─ SÍ → ¿expirado localmente? (session_expires_at < now)
  │         ├─ SÍ → limpiar sesión, flujo de login
  │         └─ NO → ¿cache de validación vigente? (TTL 5 min)
  │              ├─ SÍ → continuar (no llamar monolito)
  │              └─ NO → validar con monolito:
  │                   GET /api/v1/auth/wa-sessions/validate?tokenId=tok_abc
  │                   ├─ 200 OK → actualizar cache, continuar
  │                   └─ 401 → limpiar sesión, flujo de login
  └─ Usar JWT para llamar monolito (mismos endpoints que web)
```

Cache de validación: Caffeine TTL 5 min. Si admin cierra sesión, máximo 5 min de delay.

---

## Gestión desde la web

### Usuario cierra sus propias sesiones

```
Mi perfil → Sesiones WhatsApp activas
  📱 593991234 — Última actividad: hace 2 horas  [Cerrar]
  📱 593994567 — Última actividad: hace 3 días   [Cerrar]
  [Cerrar todas mis sesiones]
```

### Admin gestiona sesiones de staff

```
Admin → Usuarios → María → Sesiones WhatsApp
  📱 593991234 — Última actividad: hace 2 horas  [Cerrar]
  [Cerrar todas]
  [Desactivar usuario + cerrar todas]  ← desactiva RBAC + staff_phones + sesiones
```

### Endpoints en monolito

```
POST   /api/v1/auth/wa-sessions/create     — generar JWT + sesión (post-OAuth/OTP)
GET    /api/v1/auth/wa-sessions/validate    — validar tokenId (bot llama esto)
GET    /api/v1/auth/wa-sessions/me          — listar mis sesiones activas
DELETE /api/v1/auth/wa-sessions/{id}        — cerrar una sesión
DELETE /api/v1/auth/wa-sessions/me/all      — cerrar todas mis sesiones
DELETE /api/v1/auth/wa-sessions/user/{userId}/all  — admin cierra todas de un user

POST   /api/v1/auth/wa-link/initiate       — generar nonce para OAuth link
POST   /api/v1/auth/wa-link/callback        — callback post-OAuth
POST   /api/v1/auth/wa-otp/send            — enviar OTP por email
POST   /api/v1/auth/wa-otp/verify          — verificar OTP → JWT
```

---

## Qué reemplaza y qué se mantiene

| Antes (API Key) | Ahora (JWT) | API Key se mantiene para |
|-----------------|-------------|-------------------------|
| Bot llama monolito como `service@internal` | Bot llama con JWT del usuario real | Notificaciones push (monolito → bot) |
| `created_by = service@internal` | `created_by = userId` de María | Batch jobs / cron |
| Authorities pasadas como header dato | Authorities verificadas por monolito en JWT | Health checks |
| Endpoints `/internal/` necesarios | Reutiliza `/api/v1/` existentes | Operaciones sin usuario |

---

## Seguridad

| Amenaza | Mitigación |
|---------|-----------|
| SIM swap (roban número) | OTP va por email, no por WhatsApp. Google OAuth requiere contraseña Google |
| Teléfono perdido/robado | Admin cierra sesiones desde web. Staff cierra desde web en otro dispositivo |
| Empleado despedido | Desactivar usuario → sesiones mueren automático |
| JWT robado de la DB del bot | JWT cifrado con AES en conversations. Sin clave = inútil |
| Replay de token invalidado | Validación con monolito cada 5 min por tokenId |

---

## Decisiones pendientes

- [x] **Refresh token o re-login** → Re-login. JWT expira → bot pide auth de nuevo (Google/OTP). 7 días de TTL = fricción mínima (1 tap/semana). Sin refresh token = menos superficie de ataque
- [x] **Rate limit OTP** → 3 intentos cada 10 min (configurable: `otp_max_attempts`, `otp_lockout_minutes`)
- [x] **WhatsApp Flows para login** → Fase posterior. MVP usa Google OAuth link + OTP email. Flows documentado en módulo 08
- [x] **Notificación email al login** → Sí. Email al usuario: "Se inició sesión WhatsApp desde 593991234". Seguridad básica para detectar acceso no autorizado
