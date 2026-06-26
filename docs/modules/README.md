# Módulos de FerriBot

Documentación de cada módulo planificado. Cada archivo define: problema, solución, tools, modelo de datos, y decisiones pendientes.

## Índice

| # | Módulo | Estado | Descripción |
|---|--------|--------|------------|
| 01 | [Tool Packs / Habilidades](01-tool-packs-abilities.md) | En diseño | Sistema de tools aditivos por privilegios RBAC |
| 02 | [Cheques](02-cheques.md) | En diseño | Registro, seguimiento y recordatorios de cheques posfechados |
| 03 | [Knowledge Base](03-knowledge-base.md) | En diseño | Blog interno de reglas y procesos, actualizable por WhatsApp |
| 04 | [Control de Acceso a Datos](04-data-access-control.md) | En diseño | Campos visibles según rol (cliente vs vendedor vs gerente) |
| 05 | [Media Processing](05-media-processing.md) | En diseño | Audio → texto (STT) + Imagen → datos (OCR via LLM vision) |
| 06 | [Rate Limiting](06-rate-limiting.md) | En diseño | Límite de mensajes para clientes con advertencias progresivas |
| 07 | [AI Memory](07-ai-memory.md) | En diseño | Memoria resumida del contacto (nombre, preferencias, historial) |
| 08 | [WhatsApp Interactive](08-whatsapp-interactive.md) | En diseño | Listas, botones y componentes nativos de WhatsApp |
| 09 | [Alerting](09-alerting.md) | En diseño | Monitoreo y alertas al dev/admin por comportamientos anómalos |
| 10 | [Security](10-security.md) | En diseño | 5 capas de defensa: input guard, prompt hardening, tool validation, output filter, monitoreo |
| 11 | [Auth & Sessions](11-auth-sessions.md) | En diseño | JWT por usuario vía Google OAuth / OTP. Sesiones con TTL configurable. Gestión desde web |
| 12 | [SaaS Config](12-saas-config.md) | **Tablas creadas** | Config en cascada: SuperAdmin defaults → Tenant overrides. 30 valores seed |

## Arquitectura transversal

Documentos que aplican a todos los módulos:

- [Plan de Arquitectura de Agentes](../AGENT-ARCHITECTURE-PLAN.md) — routing, RBAC, conversations, fases
- [CONTEXT.md](../../CONTEXT.md) — glosario y flujos

## Dependencias entre módulos

```
01 Tool Packs ←── todos los módulos registran sus tools aquí
      │
      ├── 02 Cheques (CHEQUE_READ, CHEQUE_WRITE)
      ├── 03 Knowledge Base (KB_WRITE)
      ├── 04 Data Access Control (PRODUCT_COST, FINANCE_READ)
      ├── 05 Media Processing (preprocesador, no es tool RBAC)
      ├── 07 AI Memory (update_contact_memory)
      └── 08 WhatsApp Interactive (send_product_list, send_confirmation)

06 Rate Limiting ←── interceptor en IncomingService, antes de todo
09 Alerting ←── transversal, cualquier módulo puede emitir alertas
10 Security ←── 5 capas: input → prompt → tools → output → monitoreo
```
