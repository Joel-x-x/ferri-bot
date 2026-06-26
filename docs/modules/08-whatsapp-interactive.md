# Módulo: WhatsApp Interactive Components

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

Hoy el bot responde solo con texto plano. WhatsApp Business API soporta componentes interactivos ricos que mejoran la experiencia: listas de selección, botones, catálogos de productos.

## Componentes disponibles en Meta Cloud API

### 1. Interactive List (hasta 10 opciones)

Ideal para: resultados de búsqueda de productos, selección de categoría, menú de opciones.

```
Bot: "Encontré 5 productos:"

┌─────────────────────────┐
│ 🔧 Resultados           │
├─────────────────────────┤
│ Tornillo 1/4 x 2"       │
│ Caja x100 — $4.50      │
├─────────────────────────┤
│ Tornillo 3/8 x 3"       │
│ Caja x50 — $6.20       │
├─────────────────────────┤
│ Tornillo autorroscante   │
│ Caja x200 — $8.90      │
└─────────────────────────┘
[Ver más]
```

El usuario toca una opción → el bot recibe el `id` de la selección → puede agregar a cotización, mostrar detalle, etc.

```typescript
// Estructura Meta API
{
  type: 'interactive',
  interactive: {
    type: 'list',
    header: { type: 'text', text: 'Resultados de búsqueda' },
    body: { text: 'Encontré 5 productos. Selecciona uno:' },
    action: {
      button: 'Ver productos',
      sections: [{
        title: 'Productos',
        rows: [
          { id: 'prod_001', title: 'Tornillo 1/4 x 2"', description: 'Caja x100 — $4.50' },
          { id: 'prod_002', title: 'Tornillo 3/8 x 3"', description: 'Caja x50 — $6.20' },
        ]
      }]
    }
  }
}
```

### 2. Reply Buttons (hasta 3 opciones)

Ideal para: confirmaciones (Sí/No), selección rápida, siguiente paso.

```
Bot: "¿Agrego el Tornillo 1/4 a la cotización?"
[Sí, agregar]  [No]  [Ver más detalles]
```

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'button',
    body: { text: '¿Agrego el Tornillo 1/4 a la cotización?' },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'add_yes', title: 'Sí, agregar' } },
        { type: 'reply', reply: { id: 'add_no', title: 'No' } },
        { type: 'reply', reply: { id: 'details', title: 'Ver detalles' } },
      ]
    }
  }
}
```

### 3. CTA URL Button

Ideal para: links a la web del tenant, PDF de cotización, tracking de pedido.

```
Bot: "Tu cotización está lista:"
[📄 Ver cotización] → https://ferridescuentos.com/cotizacion/abc123
```

### 4. Product Messages (requiere catálogo en Meta)

Ideal para: mostrar productos con imagen, precio, descripción desde el catálogo de Meta.

**Nota:** Requiere que el tenant tenga un catálogo subido en Meta Commerce Manager. Más complejo de configurar.

## Integración con el LLM

### Problema: el LLM no puede generar componentes interactivos directamente

El LLM genera texto. Los componentes interactivos requieren JSON estructurado. Solución: **tools que generan componentes**.

```typescript
// Tool que el LLM puede llamar
{
  name: 'send_product_list',
  description: 'Envía una lista interactiva de WhatsApp con los productos encontrados',
  parameters: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' }
        }
      },
      maxItems: 10
    },
    header: { type: 'string' },
    body: { type: 'string' }
  }
}

// Tool para confirmación con botones
{
  name: 'send_confirmation',
  description: 'Envía botones de confirmación al usuario',
  parameters: {
    question: { type: 'string' },
    options: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } } },
      maxItems: 3
    }
  }
}
```

### Flujo completo

```
Usuario: "busco tornillos"
  │
  ├─ LLM ejecuta tool search_products → resultados
  ├─ LLM decide mostrar como lista → ejecuta tool send_product_list
  ├─ Bot envía interactive list por WhatsApp
  │
  Usuario toca "Tornillo 1/4 x 2""
  │
  ├─ Meta envía interactive reply con id: "prod_001"
  ├─ IncomingService recibe como mensaje tipo "interactive"
  ├─ Se normaliza: content = "Seleccionó: Tornillo 1/4 x 2" (prod_001)"
  └─ LLM recibe como texto y continúa conversación
```

### Recepción de respuestas interactivas

```typescript
// incoming.service.ts — en handleMessage()
if (message.type === 'interactive') {
  const reply = message.interactive;
  if (reply.type === 'list_reply') {
    message.content = `Seleccionó: ${reply.list_reply.title} (${reply.list_reply.id})`;
  } else if (reply.type === 'button_reply') {
    message.content = `Respondió: ${reply.button_reply.title} (${reply.button_reply.id})`;
  }
  message.type = 'text';  // normalizar para el LLM
}
```

## Cuándo usar cada componente

| Situación | Componente | Por qué |
|-----------|-----------|---------|
| Resultados de búsqueda (3-10 items) | Interactive List | Selección limpia, sin scroll de texto |
| Confirmación sí/no | Reply Buttons | Un toque, sin escribir |
| Selección rápida (2-3 opciones) | Reply Buttons | Rápido, visual |
| Link a cotización/factura | CTA URL Button | Abre en browser |
| Un solo producto con imagen | Image + Reply Buttons | Visual + acción |

## WhatsApp Flows (fase posterior)

**Estado: Definido, NO implementar para MVP.**

WhatsApp Flows permite formularios nativos dentro del chat (sin salir de WhatsApp). Cifrado E2E real (RSA + AES-GCM entre WhatsApp y el endpoint).

### Componentes disponibles

| Componente | Qué hace | Caso de uso |
|-----------|---------|------------|
| TextInput | Campo texto (normal, email, password, number) | Login, RUC, montos |
| Dropdown | Selección de lista | Banco, categoría, bodega |
| DatePicker | Selector de fecha nativo | Vencimiento cheque |
| RadioButtons | Selección única | Tipo doc (cédula/RUC) |
| CheckboxGroup | Selección múltiple | Productos, opciones |
| OptIn | Checkbox de aceptación | Términos, confirmación |

### Casos de uso futuros

| Caso | Sin Flows (MVP) | Con Flows (futuro) |
|------|-----------------|-------------------|
| Login | Link → browser → Google OAuth | Formulario nativo: email + password |
| Registrar cheque | Bot pregunta campo por campo | Un formulario con todos los campos |
| Vincular contacto | "Dime tu cédula" → texto libre | Formulario: tipo doc + número |
| Crear pedido | Chat multi-paso | Formulario: cliente + productos |

### Restricciones

- Requiere aprobación de Meta (proceso lento)
- Max 10 pantallas por Flow
- Lógica condicional solo server-side
- Endpoint dedicado con cifrado RSA necesario

### Por qué no ahora

1. Chat + tools funciona para MVP
2. Flows requieren endpoint + cifrado RSA = complejidad extra
3. Aprobación de Meta = blocker externo
4. Son complemento del chat, no reemplazo

### Cuándo implementar

Cuando los flujos conversacionales multi-paso estén validados en producción y la fricción de "pregunta por pregunta" sea un problema medido.

## Decisiones resueltas

- [x] **LLM decide cuándo usar componente** → Sí, via tool availability (`send_product_list`, `send_confirmation`)
- [x] **Catálogo Meta Commerce Manager** → No para MVP. Listas interactivas
- [x] **Paginación >10 resultados** → "Ver más" como última opción de la lista, dispara segunda búsqueda
- [x] **WhatsApp Flows** → Definido y documentado. Implementar en fase posterior
