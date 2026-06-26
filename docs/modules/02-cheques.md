# Módulo: Cheques

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

Las ferreterías manejan cheques posfechados como forma de pago. Necesitan registrar, dar seguimiento, y recibir recordatorios de vencimiento — todo desde WhatsApp.

## Concepto clave: utilidad independiente

Cheques es una **libreta digital standalone**. No vinculado a clientes (`profiles`), ni a órdenes, ni a facturación. Solo registra datos del cheque como texto libre. Si en futuro se necesita vincular, se agrega FK nullable.

## Dónde vive la lógica

| Capa | Responsabilidad |
|------|----------------|
| **ferri-monolito** | CRUD de cheques, lógica de vencimiento, persistencia. Módulo: `finance` |
| **ferri-bot** | Tools conversacionales que llaman al monolito. Notificaciones proactivas |

ferri-bot NO almacena datos de cheques. Solo consume endpoints del monolito.

## Tools

### `register_cheque` — Privilegio: `CHEQUE_WRITE`

Staff dicta datos del cheque por WhatsApp. Bot extrae campos y confirma antes de guardar.

```
Staff: "Registra cheque del Banco Pichincha, #004521, $1,200, vence 15 julio, de cliente Ferretería López"
Bot: "Confirmo registro:
  • Banco: Pichincha
  • Nº: 004521
  • Monto: $1,200.00
  • Vence: 2026-07-15
  • Cliente: Ferretería López
  ¿Correcto?"
Staff: "Sí"
Bot: "✅ Cheque registrado"
```

Campos del cheque (definidos en monolito):
- `bank` — banco emisor
- `cheque_number` — número de cheque
- `amount` — monto
- `due_date` — fecha de vencimiento
- `client_name` o `profile_id` — emisor
- `notes` — observaciones opcionales
- `status` — pendiente / cobrado / rebotado / anulado

### `list_cheques` — Privilegio: `CHEQUE_READ`

```
Staff: "¿Qué cheques vencen esta semana?"
Bot: "3 cheques vencen esta semana:
  1. Pichincha #004521 — $1,200 — vence 15 jul — Ferretería López
  2. Guayaquil #008912 — $850 — vence 16 jul — Construmart
  3. Pacífico #001234 — $2,100 — vence 18 jul — Don Julio"
```

Filtros: por fecha, por estado, por cliente, por monto.

### `cheque_reminders` — Privilegio: `CHEQUE_READ`

Consulta recordatorios configurados. También se pueden recibir como **notificación push** (monolito → bot).

## Notificaciones proactivas

ferri-monolito ejecuta job diario → detecta cheques próximos a vencer → llama API de ferri-bot → bot envía WhatsApp al staff con privilegio `CHEQUE_READ`:

```
"🔔 Recordatorio: 2 cheques vencen mañana:
  • Pichincha #004521 — $1,200 — Ferretería López
  • Guayaquil #008912 — $850 — Construmart"
```

## Endpoints en ferri-monolito (nuevos)

```
POST   /internal/cheques              — registrar cheque
GET    /internal/cheques              — listar (filtros: dueDate, status, profileId)
GET    /internal/cheques/upcoming     — próximos a vencer (para recordatorios)
PATCH  /internal/cheques/{id}/status  — cambiar estado (cobrado, rebotado)
```

## Modelo de datos

```sql
CREATE TABLE cheques (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    bank            VARCHAR(100) NOT NULL,
    cheque_number   VARCHAR(50) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    due_date        DATE NOT NULL,
    issuer_name     VARCHAR(255),          -- texto libre, NO FK a profiles
    notes           VARCHAR(500),
    status          VARCHAR(30) DEFAULT 'PENDING',  -- PENDING, CASHED, BOUNCED, VOIDED
    created_at      TIMESTAMP DEFAULT NOW(),
    created_by      UUID,
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

Standalone. Sin FK a profiles, orders ni invoices.

## Decisiones resueltas

- [x] **Módulo en monolito** → Nuevo módulo `finance` (cheques + futuro: cuentas por cobrar/pagar)
- [x] **Recordatorios** → 5, 3, 1 días antes del vencimiento. Configurable: `cheque_reminder_days` en `saas_config`
- [x] **Cheque rebotado** → Alerta severity `warning` al admin + conversation_event si hay conversación activa
- [x] **Vinculación a clientes** → No por ahora. `issuer_name` es texto libre. FK nullable a `profiles` en futuro si se necesita
