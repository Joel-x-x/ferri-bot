# Módulo: AI Memory (Memoria del Cliente)

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

El bot olvida todo entre conversaciones. Si Juan preguntó por tornillos ayer, hoy no sabe quién es Juan. Necesitamos memoria eficiente: guardar solo lo importante, resumido, sin abusar de storage.

## Qué guardar y qué NO

| Guardar | No guardar |
|---------|-----------|
| Nombre del contacto (si lo dice) | Historial completo de mensajes (ya está en message_history) |
| Preferencias: marcas, categorías favoritas | Conversaciones triviales ("hola", "gracias") |
| Tipo de negocio: constructor, electricista, plomero | Preguntas puntuales sin patrón |
| Frecuencia: cliente recurrente vs primera vez | Datos sensibles: cédula, teléfonos de terceros |
| Último producto consultado / comprado | Opiniones o quejas textuales |

## Dónde vive

En la tabla `conversations` (singleton), campo JSONB:

```sql
ALTER TABLE conversations ADD COLUMN contact_memory JSONB DEFAULT '{}';
```

Ejemplo:

```json
{
  "name": "Juan Pérez",
  "business_type": "electricista",
  "preferences": ["cables", "breakers", "canaletas"],
  "notes": "Pide siempre marca Cablec. Compra al por mayor.",
  "last_interaction_summary": "Cotizó 500m cable #12 + 20 breakers 20A",
  "updated_at": "2026-06-25"
}
```

### ¿Por qué en conversations y no tabla aparte?

- Es 1:1 con la conversación (singleton). No hay cardinalidad N.
- JSONB flexible — cada tenant puede tener notas distintas sin migración.
- Se lee junto con la conversación — un solo query.

## Cómo se llena

### Opción A: El LLM extrae automáticamente (recomendada)

Al final de cada interacción significativa, el system prompt instruye al LLM:

```
Si durante esta conversación aprendiste información nueva sobre el contacto 
(nombre, tipo de negocio, preferencias de marca, patrones de compra), 
usa el tool `update_contact_memory` con un resumen conciso.
No guardes saludos, despedidas ni información trivial.
```

Tool:
```typescript
{
  name: 'update_contact_memory',
  description: 'Actualiza la memoria del contacto con información relevante aprendida',
  parameters: {
    name: { type: 'string', required: false },
    business_type: { type: 'string', required: false },
    preferences: { type: 'array', items: { type: 'string' }, required: false },
    notes: { type: 'string', required: false },
    last_interaction_summary: { type: 'string', required: false }
  }
}
```

### Opción B: Summarization periódica

Job que analiza últimos N mensajes y genera resumen. Más costoso (llamada extra al LLM) y menos preciso.

**Recomendación: A.** El LLM ya está procesando la conversación. Extraer memoria es un tool call barato al final.

## Cómo se usa

Al inicio de cada conversación, `contact_memory` se inyecta en el system prompt:

```typescript
if (conversation.contactMemory && Object.keys(conversation.contactMemory).length > 0) {
  const memory = conversation.contactMemory;
  parts.push(`CONTEXTO DEL CONTACTO:
    Nombre: ${memory.name || 'Desconocido'}
    Tipo: ${memory.business_type || 'No identificado'}
    Preferencias: ${memory.preferences?.join(', ') || 'Sin datos'}
    Notas: ${memory.notes || 'Sin notas'}
    Última interacción: ${memory.last_interaction_summary || 'Primera vez'}`);
}
```

Resultado: "Hola Juan, ¿buscas más cable Cablec?" en vez de "Hola, ¿en qué puedo ayudarte?"

## Memoria para ambos: staff y clientes

| Audiencia | Qué guarda | Ejemplo |
|-----------|-----------|---------|
| **Cliente** | Nombre, tipo de negocio, preferencias de producto, marcas favoritas | `"Juan Pérez. Electricista. Prefiere Cablec. Compra al mayor"` |
| **Staff** | Patrones de uso del bot, consultas frecuentes, preferencias de formato | `"Consulta reportes de ventas los lunes 8am. Prefiere resumen corto"` |

### ¿Por qué staff también?

Staff ya tiene perfil en monolito (nombre, rol, privilegios). Pero el monolito no sabe **cómo usa el bot**. La memoria del bot captura hábitos de interacción, no identidad.

## Límites — no sobrecargar al LLM

```
Contexto total del LLM:
  System prompt:       ~1,300 tokens
  Contact memory:      ~100 tokens MAX  ← límite duro (~400 chars)
  Historial (20 msgs): ~2,000-4,000 tokens
  Tools (5-15):        ~500-1,500 tokens
  ─────────────────────────────────────
  Total:               ~4,000-7,000 tokens
```

100 tokens de memoria = ~400 caracteres. Suficiente para un resumen útil. Si crece más, el tool `update_contact_memory` **reemplaza** el resumen con una versión más concisa (no acumula, sobrescribe).

Reglas:
- `contact_memory` JSONB max ~2KB en DB
- Solo ~400 chars se inyectan al system prompt (truncado si excede)
- `update_contact_memory` max 1 vez por conversación (evitar spam)
- El LLM resume, no acumula: nueva info reemplaza/refina la memoria existente

## Sin expiración

**La memoria NO expira.** Si un contacto no escribe en meses, su memoria se mantiene. Razón: las preferencias rara vez cambian (un electricista sigue siendo electricista). Si algo cambia, el LLM actualiza la memoria naturalmente en la siguiente conversación.

Si el contacto pide "olvídame" → bot limpia `contact_memory` manualmente.

## Privacidad

- Contacto puede preguntar "¿Qué sabes de mí?" → bot devuelve `contact_memory` en texto amigable
- Contacto puede pedir "Olvídame" → bot limpia `contact_memory = '{}'`
- No se guardan datos sensibles (cédula, dirección exacta). Esos van en `contact_profiles`

## Decisiones resueltas

- [x] **Staff también acumula** → Sí. Guarda patrones de uso del bot, no identidad (eso está en monolito)
- [x] **Contacto puede ver sus datos** → Sí. "¿Qué sabes de mí?" devuelve memoria en texto amigable
- [x] **Expiración** → No hay. Memoria persiste indefinidamente. Se actualiza naturalmente. Borrado solo manual ("olvídame")
