# Módulo: Media Processing (Audio + Imagen)

Estado: **En diseño** | Fecha: 2026-06-25

---

## Problema

Los usuarios de WhatsApp envían audios e imágenes constantemente. Hoy el bot solo procesa texto. Se necesita:

1. **Audio → Texto**: Staff dicta en vez de escribir. Bot debe entender.
2. **Imagen → Texto (OCR)**: Staff envía foto de factura, cheque, lista de precios. Bot extrae datos.
3. **Confirmación**: Datos extraídos deben ser confirmados antes de accionar.

## Flujo: Audio (Speech-to-Text)

```
Staff envía audio de 15 segundos
  │
  ├─ Bot descarga media de Meta Cloud API
  ├─ Envía a servicio STT (Whisper / Google STT / provider del tenant)
  ├─ Recibe transcripción
  ├─ Transcripción se inyecta como contenido del mensaje
  └─ Procesamiento normal (como si hubiera escrito texto)
```

### Transparente al flujo

El audio se convierte a texto **antes** de llegar al LLM. Para el LLM, es un mensaje de texto normal. No hay tools ni flujos especiales — solo un preprocesador.

```typescript
// incoming.service.ts — en handleMessage()
if (message.type === 'audio') {
  const mediaUrl = await metaService.downloadMedia(message.audio.id);
  const transcription = await sttService.transcribe(mediaUrl);
  message.content = transcription;
  message.type = 'text';  // normalizar
}
```

### Proveedor STT

**Decisión: Groq Whisper como default, configurable por tenant con fallback.**

| Servicio | Precio/min | Latencia 30s | OGG nativo | Español LATAM |
|----------|-----------|-------------|-----------|---------------|
| **Groq Whisper** (default) | **$0.00067** | **~0.1s** | Sí | Buena |
| OpenAI Whisper (fallback) | $0.006 | ~0.9s | Sí | Buena |
| Google V2 (override) | $0.016 | ~2-4s | Sí | **es-EC** nativo |
| Deepgram Batch | $0.0043 | ~1-3s | Sí | Buena |

Costo mensual (10,000 audios de 1 min): Groq = **$0.40**, OpenAI = $3.60, Google = $9.60.

Configurable vía `saas_config`:
```
stt_provider = 'groq'                        -- default global
stt_fallback_provider = 'openai'             -- si Groq falla
```

Tenant override vía `tenant_config`:
```
tenant_config(tenant_id, 'stt_provider', 'google')  -- si necesita es-EC específico
```

WhatsApp envía OGG/OPUS. Groq, OpenAI y Google aceptan `.ogg` directo — sin conversión de formato.

## Flujo: Imagen (OCR + Extracción)

```
Staff envía foto de cheque
  │
  ├─ Bot descarga imagen de Meta Cloud API
  ├─ Imagen se envía al LLM como input multimodal (vision)
  │   └─ System prompt: "Extrae los campos del cheque: banco, número, monto, 
  │      fecha, beneficiario. Responde en JSON."
  ├─ LLM responde con datos extraídos
  ├─ Bot presenta datos al usuario para confirmación
  │   └─ "Extraje estos datos del cheque:
  │       • Banco: Pichincha
  │       • Nº: 004521
  │       • Monto: $1,200
  │       ¿Correcto?"
  ├─ Usuario confirma → Bot ejecuta tool (register_cheque, etc.)
  └─ Usuario corrige → Bot ajusta y re-confirma
```

### Tipos de imagen soportados

| Tipo | Qué extrae | Tool que ejecuta post-confirmación |
|------|-----------|-----------------------------------|
| Foto de cheque | Banco, número, monto, fecha, beneficiario | `register_cheque` |
| Foto de factura | Proveedor, items, totales, RUC | `register_purchase` (futuro) |
| Foto de lista de precios | Productos, precios, proveedor | `update_prices` (futuro) |
| Foto de producto | Identificar producto, marca, modelo | `search_products_erp` |
| Captura de pantalla | Texto general | Respuesta contextual |

### Confirmación obligatoria

**Regla: OCR NUNCA ejecuta acciones sin confirmación del usuario.**

El LLM extrae datos. Los presenta. El usuario confirma. Solo entonces se ejecuta el tool. Esto es un **flujo con estado**:

```
active_flow: 'OCR_CONFIRM'
flow_state: 'AWAITING_CONFIRMATION'
flow_data: { 
  extracted: { bank: 'Pichincha', number: '004521', amount: 1200 },
  target_tool: 'register_cheque',
  image_url: '...'
}
```

### Vision API

**Decisión: usar el MISMO provider del tenant. No agregar servicio de vision separado.**

El LLM del tenant (Gemini/OpenAI/Claude) ya soporta vision. La imagen se inyecta como parte del mensaje — un solo call hace OCR + interpretación + JSON.

| Provider | Costo/imagen (1024x768) | JSON estructurado | Manuscrito |
|----------|------------------------|-------------------|-----------|
| Gemini 2.5 Flash | ~$0.0004 | Sí (schema nativo) | Bueno |
| GPT-4o-mini | ~$0.0001 | Sí (Structured Outputs) | Aceptable |
| Claude Haiku 4.5 | ~$0.0010 | Via tools | Bueno |

Costo 1,000 imágenes/mes: $0.10 - $0.89. Despreciable.

**LLM Vision > OCR dedicado** porque: un solo paso (OCR + interpretación + JSON), los documentos son variados (cheques, facturas, productos), y el volumen es bajo.

```typescript
// incoming.service.ts — imagen se inyecta como multimodal
if (message.type === 'image') {
  const imageBase64 = await downloadAndEncode(message.image.id);
  messages.push({
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
      { type: 'text', text: userCaption || 'Analiza esta imagen según el contexto de la conversación.' }
    ]
  });
}
// El adapter del tenant (Gemini/OpenAI/Claude) ya soporta vision — zero config extra
```

## Decisiones resueltas

- [x] **STT provider** → Groq Whisper default, configurable por tenant (`stt_provider` en `saas_config`), fallback a OpenAI
- [x] **Límite de audio** → 30 min default, configurable (`audio_max_duration_seconds` en `saas_config`, min=10, max=3600)
- [x] **Transcripción en message_history** → Sí, como `content` del mensaje. El audio se normaliza a texto antes de llegar al LLM
- [x] **Vision provider** → Mismo provider del tenant. No servicio separado. Todos soportan vision. Costo despreciable (~$0.0004/imagen)
