# Módulo: Control de Acceso a Datos

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

El mismo producto tiene información diferente según quién pregunte:

- **Cliente**: solo ve PVP y disponibilidad
- **Vendedor**: ve PVP + precio mayorista
- **Gerente/Contador**: ve PVP + mayorista + costo + utilidad + IVA

Hoy esto está hardcodeado: staff ve todo, cliente ve solo PVP. Pero con roles granulares (RBAC), necesitamos control más fino.

## Solución: Data Views por privilegio

No se filtra en el bot — se filtra en el **endpoint del monolito**. El bot pasa los privilegios del usuario, el monolito devuelve solo los campos permitidos.

```
Bot → GET /api/v1/products/search?q=tornillo
      Header: Authorization: Bearer <JWT del staff>

Monolito extrae authorities del JWT y responde según privilegios:
  - Sin PRODUCT_READ        → 403
  - PRODUCT_READ             → { name, sku, pvp, stock }
  - PRODUCT_READ + PRODUCT_COST → { name, sku, pvp, costPrice, wholesalePrice, stock }
  - PRODUCT_READ + PRODUCT_COST + FINANCE_READ → { + margin, taxRate, profitability }
```

### Agente Externo (clientes)

Usa Algolia (índice público). El índice SOLO contiene campos públicos:
- Nombre, descripción, SKU, PVP, imagen, disponibilidad
- **Nunca** costo, mayorista, utilidad, IVA

No hay riesgo de filtración — los datos sensibles nunca llegan a Algolia.

### Agente Interno (staff)

Usa endpoint ERP. El monolito filtra campos según authorities del usuario.

## Mapeo privileges → campos visibles

| Campo | Privilegio requerido | Quién lo tiene |
|-------|---------------------|---------------|
| Nombre, SKU, descripción | `PRODUCT_READ` | Todos los internos |
| PVP | `PRODUCT_READ` | Todos los internos |
| Stock por bodega | `INVENTORY_READ` | Bodeguero, Cajero, Gerente |
| Precio mayorista | `PRODUCT_COST` | Vendedor, Gerente, Contador |
| Precio costo | `PRODUCT_COST` | Gerente, Contador |
| Margen / utilidad | `FINANCE_READ` | Gerente, Contador |
| IVA desglosado | `FINANCE_READ` | Gerente, Contador, Cajero |

## System prompt dinámico

El `PromptBuilder` inyecta reglas según lo que el usuario puede ver:

```typescript
if (authorities.includes('PRODUCT_COST')) {
  parts.push('Muestra precios diferenciados: costo, mayorista y PVP.');
}
if (authorities.includes('FINANCE_READ')) {
  parts.push('Incluye margen de utilidad y desglose de IVA cuando te lo pidan.');
}
if (!authorities.includes('PRODUCT_COST')) {
  parts.push('NUNCA menciones precios de costo ni mayorista. Solo PVP.');
}
```

## Principio de seguridad

**Doble barrera:**
1. **System prompt** le dice al LLM qué puede/no puede mostrar
2. **Endpoint del monolito** no devuelve campos que el usuario no puede ver

Si el LLM "alucina" un costo, el dato real nunca estuvo en su contexto. La barrera real es el endpoint.

## Decisiones resueltas

- [x] **`PRODUCT_COST`** → Nuevo privilegio. Separa lectura pública (`PRODUCT_READ` = PVP) de costos internos (`PRODUCT_COST` = costo + mayorista)
- [x] **`FINANCE_READ`** → Nuevo privilegio. Para margen, utilidad, IVA desglosado
- [x] **Admin configura campos por rol** → No por ahora. Hardcoded en monolito. El mapeo privilegio→campos está en el endpoint
