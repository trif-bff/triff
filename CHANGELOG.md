# Changelog

## [0.3.0] — 2026-11-09 — OCR de fotos y PDF escaneados (Fase 11)
### Añadido
- Subida de fotos de apuntes (PNG, JPG, WEBP) y botón «Hacer una foto» con la cámara del móvil.
- OCR local con **Tesseract 5** (español, catalán e inglés): sin servicios externos ni coste; los archivos no salen del servidor.
- PDF escaneados o mixtos: solo se rasterizan (poppler, 200 ppp) y se leen las páginas **sin capa de texto**; se conservan los números de página para las citas.
- Confianza del OCR por documento (media ponderada por palabra), insignia «OCR · N %» y aviso de «lectura dudosa» por debajo del 70 %.
- Seguridad: validación por magic bytes, lectura de dimensiones desde la cabecera para rechazar «bombas de descompresión» (> 40 MP), `execFile` sin shell con tiempo máximo por página, límite de 25 páginas de OCR por archivo y directorio temporal privado que siempre se borra.
- Mensajes claros cuando no se puede leer texto o cuando el servidor no tiene OCR.
- Dockerfile y CI con Tesseract y poppler. Fixtures reproducibles (`scripts/make-ocr-fixtures.mjs`).
- Tests: +12 (unit e integración) y E2E de foto con OCR y de PDF con texto sin OCR.
### Limitaciones conocidas
- Tesseract está pensado para texto impreso: la letra manuscrita se acepta pero suele dar confianza baja. Con un proveedor de IA activado se usará visión del modelo para esos casos.

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
