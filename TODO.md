# FerriBot — TODO

## 🔴 Pendiente implementación

### Flujo E — Handoff a humano
- Cuando el cliente dice "hablar con una persona" / "asesor" / "humano":
  - FerriBot responde: "Te comunico con un asesor, escríbenos al [número configurado por tenant]"
  - Implementación futura: desactivar `autoReply` para ese `contactPhone` hasta que operador lo reactiva
  - Requiere: campo `humanHandoff` en `message_history` o tabla `contact_sessions`

### Número del vendedor dinámico por tenant
- Hoy: `0978729311` hardcodeado en el system prompt
- Futuro: campo `salesPhone` en tabla `meta_credentials` o nueva tabla `tenant_config`
- Afecta: notificación de cotización + handoff

### Plantilla Meta para notificación al vendedor
- Hoy: `sendText()` a `0978729311` asume ventana de 24h activa (C — ok para pruebas)
- Futuro: registrar plantilla aprobada en Meta para notificaciones fuera de ventana
- Nombre propuesto: `quotation_summary` (ver sección Plantillas abajo)

### Cotización persistida (CRM)
- Hoy: cotización vive solo en el hilo de conversación (opción A)
- Futuro: entidad `Quotation` con líneas, estados (DRAFT → SENT → CONFIRMED), PDF/link
- Parte del módulo CRM — pospuesto

---

## 🟡 Plantillas Meta — pendientes de registro

### `quotation_summary` *(notificación interna al vendedor)*
Categoría: UTILITY  
Idioma: es  
Destino: número del vendedor (hoy `0978729311`)

```
🔔 *Nueva cotización vía FerriBot*

Cliente: {{1}}
Productos consultados:
{{2}}

*Total estimado: {{3}}*

Fecha: {{4}}
```

Parámetros:
1. Número de teléfono del cliente (ej. `+593987654321`)
2. Lista de productos (ej. `- Cemento Chimborazo × 2\n- Tornillo hex × 100`)
3. Total en dólares (ej. `$45.50`)
4. Fecha y hora (ej. `11/06/2026 10:35`)

---

### `product_followup` *(seguimiento post-consulta al cliente)*
Categoría: MARKETING  
Idioma: es  
Destino: cliente

```
Hola {{1}} 👋, soy FerriBot de {{2}}.

Vimos que consultaste sobre *{{3}}*. ¿Pudiste encontrar lo que buscabas?

Si necesitas una cotización o tienes preguntas, responde este mensaje y te ayudo de inmediato.
```

Parámetros:
1. Nombre del cliente (o "cliente" si no se conoce)
2. Nombre de la tienda
3. Producto consultado

---

## ⚪ Deuda técnica

- `ALGOLIA_SEARCH_KEY` separada de `ALGOLIA_API_KEY` — ambas en `.env` del VPS, unificar criterio
- Sistema de sesiones de conversación para detectar inactividad y reiniciar flujo de bienvenida
- Tests unitarios para `AlgoliaService.formatProductsForAi()`
