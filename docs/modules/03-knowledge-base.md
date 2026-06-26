# Módulo: Knowledge Base (Interno + Externo)

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

Las ferreterías necesitan un lugar central para reglas internas, procesos, políticas, y conocimiento del negocio. Hoy esa información vive en la cabeza del dueño o en grupos de WhatsApp perdidos. Además, los clientes preguntan lo mismo una y otra vez (horarios, políticas de devolución, ubicación).

## Concepto

**Knowledge Base (KB)** = colección de entradas de texto organizadas por categoría, actualizables por mensaje de WhatsApp. Dos niveles de visibilidad:

| Nivel | Quién ve | Contenido típico | Privilegio para escribir |
|-------|---------|-----------------|------------------------|
| **KB Interna** | Solo staff (Agente Interno) | Procesos, márgenes, proveedores, reglas operativas | `KB_WRITE` |
| **KB Externa** | Staff + clientes vinculados (Agente Externo) | FAQ, horarios, políticas de devolución, ubicación, métodos de pago | `KB_WRITE` |

La visibilidad se controla por **categoría**, no por entrada individual. Cada categoría tiene un flag `is_public`.

## Cómo funciona

### Escribir (admin/autorizados)

```
Admin: "Agrega a procesos: Para devoluciones mayores a $50, se requiere 
        autorización del gerente. El cliente debe presentar factura original."
Bot: "✅ Entrada agregada a 'Procesos':
      Devoluciones mayores a $50 — autorización gerente + factura original"
```

### Consultar (cualquier staff)

```
Bodeguero: "¿Cuál es el proceso de devolución?"
Bot: "Según la KB:
      • Devoluciones menores a $50: cajero puede aprobar directo
      • Devoluciones mayores a $50: requiere autorización del gerente. 
        Cliente debe presentar factura original.
      (Actualizado: 2026-06-20 por @gerente)"
```

### Actualizar

```
Admin: "Actualiza la regla de devoluciones: ahora el límite es $100, no $50"
Bot: "✅ Entrada actualizada en 'Procesos':
      Devoluciones mayores a $100 — autorización gerente + factura original
      (Anterior: $50)"
```

## Dónde vive

| Opción | Pro | Contra |
|--------|-----|--------|
| **A. ferri-monolito** | Fuente de verdad central, accesible desde web y bot | Más endpoints, más complejo |
| **B. ferri-bot local** | Rápido de implementar, sin dependencia | Duplicación si la web también lo necesita |

**Recomendación: A (monolito).** La web va a necesitar CRUD de KB eventualmente. Mejor centralizar.

## Modelo de datos (en monolito)

```sql
-- Categorías libres por tenant, con flag de visibilidad
CREATE TABLE kb_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        VARCHAR(100) NOT NULL,
  is_public   BOOLEAN DEFAULT FALSE,    -- TRUE = visible para Agente Externo (clientes)
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Entradas de la KB
CREATE TABLE kb_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES kb_categories(id),
  title       VARCHAR(255) NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID NOT NULL,
  updated_by  UUID,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_kb_entries_tenant_cat ON kb_entries(tenant_id, category_id);
```

### Seed de categorías sugeridas (por tenant)

| Categoría | `is_public` | Contenido típico |
|-----------|------------|-----------------|
| `procesos` | `false` | Devoluciones internas, apertura/cierre caja |
| `políticas` | `false` | Descuentos, crédito, márgenes |
| `productos` | `false` | Guías técnicas, equivalencias, proveedores |
| `FAQ` | **`true`** | Horarios, ubicación, métodos de pago, devoluciones |
| `envíos` | **`true`** | Zonas de cobertura, tiempos de entrega, costos |

## Búsqueda

Para consultas del bot, dos opciones:

| Opción | Cómo | Cuándo |
|--------|------|--------|
| **Full-text search (PostgreSQL)** | `tsvector` + `tsquery` en `content` | Pocas entradas (<500 por tenant). Suficiente para MVP |
| **Algolia / embeddings** | Indexar KB en Algolia o vector DB | Muchas entradas o necesidad de búsqueda semántica |

**Recomendación:** PostgreSQL full-text search para MVP. Migrar a embeddings si crece.

## Tools

### `query_kb` — Sin privilegio especial (cualquier staff)

```typescript
{
  name: 'query_kb',
  description: 'Busca en la base de conocimiento interna del negocio',
  parameters: {
    query: { type: 'string', required: true },
    category: { type: 'string', required: false }  // filtrar por categoría
  }
}
```

### `update_kb` — Privilegio: `KB_WRITE`

```typescript
{
  name: 'update_kb',
  description: 'Agrega o actualiza una entrada en la base de conocimiento',
  parameters: {
    action: { type: 'string', enum: ['create', 'update'], required: true },
    category: { type: 'string', required: true },
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    entry_id: { type: 'string', required: false }  // solo para update
  }
}
```

## Tools

### `query_kb` — Cualquier staff (interno) / Clientes solo categorías públicas

```typescript
{
  name: 'query_kb',
  privileges: [],  // sin privilegio — acceso controlado por is_public
  description: 'Busca en la base de conocimiento',
  parameters: {
    query: { type: 'string', required: true },
    category: { type: 'string', required: false }
  }
}
```

Resolución:
- **Agente Interno** → busca en TODAS las categorías
- **Agente Externo** → busca solo en categorías con `is_public = true`

### `update_kb` — Privilegio: `KB_WRITE`

```typescript
{
  name: 'update_kb',
  privileges: ['KB_WRITE'],
  description: 'Agrega o actualiza entrada en la KB',
  parameters: {
    action: { type: 'string', enum: ['create', 'update'] },
    category: { type: 'string', required: true },
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    entry_id: { type: 'string', required: false }  // solo para update
  }
}
```

### `delete_kb` — Privilegio: `KB_ADMIN`

Solo eliminación. Separado de `KB_WRITE` para proteger contenido.

## Ejemplos

### Staff consulta KB interna
```
Bodeguero: "¿Cuál es el proceso de devolución?"
Bot: [query_kb, busca en TODAS las categorías]
     "Según procesos internos:
      • Devoluciones <$100: cajero aprueba directo
      • Devoluciones >$100: autorización del gerente + factura original"
```

### Cliente consulta KB externa
```
Cliente: "¿Cuál es el horario?"
Bot: [query_kb, busca solo en categorías is_public=true]
     "Nuestro horario:
      • Lun-Vie: 8:00 - 18:00
      • Sáb: 8:00 - 14:00
      • Dom: Cerrado"
```

### Admin actualiza por WhatsApp
```
Admin: "Agrega a FAQ: Aceptamos transferencias bancarias, efectivo y cheques"
Bot: "✅ Agregado a FAQ:
      Métodos de pago — Transferencias bancarias, efectivo y cheques"
```

## Decisiones resueltas

- [x] **Categorías** → Libres por tenant. Seed con 5 sugeridas. Tenant crea las que quiera
- [x] **Versionamiento** → No para MVP. `updated_at` + `updated_by` basta
- [x] **Eliminar** → Solo `KB_ADMIN` (nuevo privilegio separado de `KB_WRITE`)
- [x] **Agente Externo** → Sí, consulta categorías con `is_public = true` (FAQ, envíos, etc.)
- [x] **Interno vs Externo** → Controlado por `is_public` en `kb_categories`. No dos KBs separadas
