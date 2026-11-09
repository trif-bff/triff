---
name: rag-safety
description: Checklist para cambios en la ingesta documental, la recuperación (RAG) o cualquier punto donde texto de usuarios/documentos llega a un modelo. Úsala al tocar src/lib/docs, src/lib/rag, src/lib/ai o rutas del tutor.
---

# Seguridad del RAG

- [ ] El texto de documentos entra al modelo SOLO vía `formatSources()` (neutraliza `<source>`, `<system>`…).
- [ ] El system prompt declara que las fuentes son datos y que se ignoren sus instrucciones.
- [ ] Los fragmentos sospechosos (`scanForInjection`) se marcan `suspicious="true"`.
- [ ] La recuperación filtra por `subjectId` **y** `documents.user_id` en SQL.
- [ ] El modelo no tiene herramientas con efectos externos; si se añade una, requiere confirmación del usuario.
- [ ] Salida del modelo renderizada sin HTML crudo.
- [ ] Hay test en `tests/unit` o `tests/integration` con un documento malicioso (ver `tests/fixtures/injection.md`).
- [ ] Las citas `[n]` apuntan a fragmentos reales devueltos en `X-Citations`.
