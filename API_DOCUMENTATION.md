# API

Todas las rutas requieren sesión (cookie de Better Auth). Las mutaciones validan `Origin` (CSRF), aplican rate limit por usuario y validan con Zod. Errores: `{ "error": "mensaje" }` con el código HTTP correspondiente.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET/POST /api/auth/*` | Endpoints estándar de Better Auth (registro, inicio y cierre de sesión, recuperación de contraseña) | Sesión |
| `POST /api/subjects/:id/documents` | `multipart/form-data` con `file` (PDF —también escaneado—, DOCX, TXT, MD, PNG, JPG, WEBP ≤ 15 MB; imágenes ≤ 40 MP) | `201 { id, chunks, injectionFlags, pageCount, ocr: null \| { pages, confidence, skippedPages, lowConfidence } }` · 409 duplicado · 413 tamaño · 415 formato · 422 sin texto legible. Hasta 300 s con OCR |
| `POST /api/subjects/:id/flashcards` | `{ topicId?: uuid, count?: 1–40 }` | `{ created, origin: "ai"|"heuristic"|"none", message? }` |
| `POST /api/subjects/:id/quizzes` | `{ topicId?: uuid, count?: 3–30 }` | `{ quizId, origin, message? }` |
| `POST /api/subjects/:id/mocks` | `{ questions?: 5–40 (20), minutes?: 5–180 (30) }` | `201 { quizId, questions }` · 422 si no hay apuntes o no alcanzan 5 preguntas. El reloj empieza en el servidor |
| `POST /api/review` | `{ cardId, rating: 1–4, durationMs }` | `{ due, state }` (actualiza FSRS y registra evidencia) |
| `POST /api/quiz/:id/submit` | `{ answers: [{ questionId, selected: number[] }], durationMs }` | `{ score, total, results: [{ questionId, correct, correctOptions, explanation }] }` (registra evidencias y recalcula el plan). **Si es un simulacro**: `{ report: { grade, answered, total, byTopic, weakest, trend, late, usedSec, limitSec, verdict }, results }`; segunda entrega → 409 |
| `POST /api/tutor` | `{ conversationId?, subjectId?, mode: explain|solver|socratic|practice, style?, message, image?: dataURL }` | **Stream de texto**. Cabeceras `X-Conversation-Id` y `X-Citations` (JSON base64 `[{ n, chunkId, filename, page }]`) |
| `GET /api/tutor?conversationId=` | — | `{ conversation, messages }` |

Las respuestas de `review`, `quiz/:id/submit` (práctica y simulacro) y `documents` incluyen `rewards: { xp, badges: [{ id, name }], challengesCompleted: string[] }`.

Server actions (formularios): `toggleGamification`, `createSubject`, `updateSubject`, `deleteSubject`, `togglePlanItem`, `rebuildPlan` — todas con `requireUser()` y filtro por propietario.

Límites: 40 operaciones de IA/día en plan gratuito (`AI_DAILY_LIMIT_FREE`), 429 al superarlo. Las operaciones fallidas no cuentan.
