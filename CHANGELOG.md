# Changelog

## [0.2.0] — 2026-11-09 — Simulacro de examen escrito (Fase 8)
### Añadido
- Simulacros cronometrados por asignatura: número de preguntas y duración configurables; el tiempo lo controla el servidor (`started_at`) y la entrega es automática al llegar a cero.
- Selección de preguntas **estratificada por importancia del tema** (reparto por restos mayores, cobertura de todos los temas con material) e intercalada como en un examen real; distractores tomados de todo el temario.
- Una sola entrega por simulacro; las entregas fuera de tiempo (más de 30 s de margen) se corrigen y se marcan.
- Informe: nota orientativa 0–10, veredicto respecto a la nota objetivo, resultado por tema, temas a repasar con enlace a la tutora, tiempo usado y comparación con el simulacro anterior. Se reconstruye al recargar.
- Historial de simulacros en la asignatura; el «Simulacro» del plan enlaza aquí. Las respuestas alimentan el modelo de dominio y recalculan el plan.
- Tests: +16 (unit e integración) y +2 E2E (flujo completo y entrega automática por tiempo).

## [0.1.0] — 2026-11-09 — MVP
### Añadido
- Registro, inicio y cierre de sesión (Better Auth, email + contraseña).
- Asignaturas con fecha de examen, nivel, nota objetivo, tiempo diario y modo "solo mis apuntes".
- Ingesta documental PDF/DOCX/TXT/MD: validación por magic bytes, deduplicación, extracción por página, chunking por estructura, detección de prompt injection, índice FTS en español y embeddings opcionales (pgvector).
- Mapa de conocimiento automático (temas, importancia, fusión de duplicados).
- Tutora con 4 modos (Explicar ×6 estilos, Resolver paso a paso, Socrático, Práctica), streaming, imágenes, citas a los apuntes y modo honesto sin IA.
- Flashcards con FSRS-6 consciente de la fecha del examen; cuestionarios ABCD y V/F con explicación y fuente; generación con IA o por extracción literal.
- Motor de dominio basado en evidencias, detección de lagunas, decisiones explicables y plan de estudio adaptativo.
- Dashboard: saludo, "¿Qué quieres aprender hoy?", plan del día, recomendaciones con su motivo, dominio, racha, tiempo, tarjetas pendientes, asignaturas y próximos exámenes.
- Sistema de diseño propio (claro/oscuro, responsive, accesible).
- Registro de consumo de IA (fallos no facturables) y cuota diaria.
- Tests: 39 unit/integración (Vitest + Postgres real), 6 E2E (Playwright, escritorio y móvil). CI de GitHub Actions.
- Configuración de Claude Code: CLAUDE.md, 9 agentes, reglas, 2 skills propias, MCP de Playwright y hooks.
