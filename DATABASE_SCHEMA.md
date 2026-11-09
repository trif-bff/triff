# Esquema de base de datos

PostgreSQL 16 + pgvector. Fuente de verdad: `src/db/schema.ts`; migraciones en `drizzle/`.

| Tabla | Propósito | Claves / índices |
|---|---|---|
| `user`, `session`, `account`, `verification` | Better Auth. `user.role` (`student`/`admin`) | `email` único, `session.token` único |
| `subjects` | Asignatura/examen: nivel, `exam_date`, `target_grade`, `minutes_per_day`, `sources_only` | idx `user_id` |
| `documents` | Archivo subido: tipo, tamaño, `sha256`, `status` (pending/processing/ready/failed), páginas, `injection_flags`, `ocr_pages`, `ocr_confidence` (0–100), error | único (`subject_id`,`sha256`) |
| `chunks` | Fragmento indexado: página, encabezado, contenido, `suspicious`, `tsv` (**generado**, `to_tsvector('spanish')`), `embedding vector(1536)` | GIN(`tsv`), HNSW(`embedding vector_cosine_ops`) |
| `topics` | Temas del mapa de conocimiento: `importance`, `normalized_title`, documento/página de origen | único (`subject_id`,`normalized_title`) |
| `flashcards` | Tarjeta + estado FSRS (`due`, `stability`, `difficulty`, `reps`, `lapses`, `state`…), `origin` (heuristic/ai/manual), fragmento fuente | idx (`user_id`,`due`), único (`subject_id`,`front`) |
| `review_logs` | Cada repaso (rating 1–4, duración) | idx (`user_id`,`reviewed_at`) |
| `quizzes`, `quiz_questions` | Cuestionario (`kind`: practice/mock, `time_limit_sec`, `started_at` fijado por el servidor) y preguntas (`mcq`/`true_false`, opciones, índices correctos, explicación, fuente) | |
| `quiz_attempts` | Intento: puntuación, duración, respuestas, `late` (entregado fuera de tiempo) | idx (`user_id`,`created_at`) |
| `evidence` | **Toda observación de aprendizaje** (kind, score 0–1, duración). El dominio se deriva de aquí | idx (`user_id`,`topic_id`), (`user_id`,`created_at`) |
| `plan_items` | Plan diario: actividad, minutos, **motivo**, hecho | idx (`user_id`,`day`) |
| `conversations`, `messages` | Historial del tutor con citas | idx (`conversation_id`,`created_at`) |
| `ai_usage` | Consumo por operación: proveedor, modelo, tokens, `success`, `billable` (= success) | idx (`user_id`,`created_at`) |
| `audit_log` | Eventos relevantes (ingesta, futuras acciones de admin) | |

Borrado: todas las tablas de usuario cuelgan de `user` con `ON DELETE CASCADE` (derecho de supresión RGPD).

Decisiones: el dominio **no se almacena**, se calcula desde `evidence` (auditable y recalculable si cambia el modelo). La dimensión del vector (1536) es común a `text-embedding-3-small` y a Gemini con `outputDimensionality: 1536`.
