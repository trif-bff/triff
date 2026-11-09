# Changelog

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
