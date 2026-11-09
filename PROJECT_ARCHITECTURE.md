# Triff — Arquitectura del proyecto

> Estado: **MVP v0.1** implementado y probado (ver `CHANGELOG.md`). Este documento recoge la auditoría, las decisiones, los costes, los riesgos y el roadmap.

## 1. Auditoría del entorno (Fase 0)

| Elemento | Resultado |
|---|---|
| Código previo | Ninguno (directorio vacío). Proyecto creado desde cero. |
| Node.js / pnpm / npm | 22.23.4 / 10.28.0 / 10.9.9 |
| Git | 2.43.0 |
| PostgreSQL | 16.15 local; **pgvector 0.6.0** instalado vía apt (`postgresql-16-pgvector`) |
| Redis | 7.0.15 instalado (no usado aún en el MVP) |
| Docker | Cliente 29.9.2, **sin daemon** en este entorno → Dockerfile no verificable aquí |
| Herramientas de documentos | poppler-utils (pdftotext, pdftoppm), ffmpeg presentes; **Tesseract 5.3 (spa, cat, eng) instalado en la v0.3** |
| Navegador | Chromium + Playwright 1.63 preinstalados |
| Red | npm y api.anthropic.com accesibles; **api.openai.com y astra-ai.co bloqueados** por la política de red |
| Credenciales | Ninguna clave de IA, Stripe, Supabase ni email configurada |

**Consecuencia:** el MVP se diseñó para funcionar **completo sin claves** (modo sin IA, basado en extracción literal de los apuntes) y activar la IA con solo añadir una variable de entorno. No se ha generado ningún coste externo.

**Sobre la referencia (Astra AI):** el sitio no era accesible desde este entorno, así que el análisis funcional se basa en la descripción del encargo (tutor, preparación de exámenes, flashcards, quiz, podcasts, examen oral, lagunas). No se ha copiado código, marca ni identidad visual.

## 2. Visión de producto

Triff es una profesora particular que **conoce el temario del estudiante** (sus documentos), **sabe qué domina** (modelo de dominio con evidencias) y **decide qué estudiar a continuación** (planificador + recomendaciones explicables).

Principios: calidad pedagógica sobre número de funciones · fidelidad a las fuentes · explicabilidad (cada recomendación dice *por qué*) · privacidad por defecto.

## 3. Arquitectura

```
┌──────────────────────────── Next.js 16 (App Router, React 19) ───────────────────────────┐
│  UI (RSC + client components)        Server Actions          Route Handlers (/api/*)     │
│  dashboard · asignaturas · tutora    crear/editar asignatura  documents · tutor (stream)  │
│  repaso · cuestionario               plan                     flashcards · quizzes · review│
├───────────────────────────────────────────────────────────────────────────────────────────┤
│  proxy.ts (redirect optimista)  →  DAL: requireUser()/guard() — autorización por consulta │
├──────────────── src/lib/services (casos de uso, I/O) ─────────────────────────────────────┤
│ documents (ingesta) · generation · progress (dominio, plan, racha) · recommend · usage    │
├──────────── src/lib/learning (lógica PURA, 100 % testeada) ──────┬──── src/lib/ai ────────┤
│ srs (FSRS-6) · mastery · planner · heuristic · grading           │ provider registry      │
├──────────── src/lib/docs + src/lib/rag ──────────────────────────┤ prompts (modos tutor)  │
│ extract (unpdf, mammoth) · chunk · injection · retrieve (FTS+vec)│ AI SDK v7              │
├───────────────────────────────────────────────────────────────────┴───────────────────────┤
│ PostgreSQL 16 + pgvector (Drizzle ORM) — tsvector español (GIN) + HNSW coseno             │
└───────────────────────────────────────────────────────────────────────────────────────────┘
        Proveedores (opcionales): Anthropic · OpenAI · Google (LLM / embeddings)
```

**Monolito modular** deliberado: un solo despliegue, límites internos claros (`learning` no conoce la BD; `services` no conoce React). Se extraerán workers cuando el procesamiento documental y la voz lo exijan (Fase 11/15).

## 4. Stack y justificación (Fase 2)

| Capa | Elección | Por qué / alternativas descartadas |
|---|---|---|
| Framework | **Next.js 16.4** + React 19 + TypeScript 5 | SSR/RSC, server actions con protección CSRF integrada, streaming. `cacheComponents` desactivado en el MVP (todas las páginas son por usuario). |
| Estilos | **Tailwind CSS 4** + tokens CSS propios | Sistema de diseño propio en `globals.css`. **shadcn/ui descartado por ahora**: su CLI descarga del registro (red) y solo necesitábamos ~8 primitivas. Reevaluar al crecer la UI. |
| Iconos / motion | lucide-react · animaciones CSS | Microinteracciones en CSS (respetan `prefers-reduced-motion`). La librería `motion` se evaluó y se retiró: aún no aporta nada que CSS no cubra. |
| BD | **PostgreSQL 16 + pgvector** + **Drizzle ORM** | Un único almacén para relacional, FTS y vectores (sin Pinecone/Qdrant). Drizzle: SQL explícito, migraciones generadas, sin runtime pesado. Compatible con **Supabase** como hosting gestionado (opción de despliegue, no dependencia). |
| Auth | **Better Auth 1.7** (email+contraseña) | Self-hosted, sesiones en BD, rate limit integrado, plugins (2FA, organizaciones, admin). Alternativas: Supabase Auth (acopla), Auth.js (menos completo para email/password). |
| IA | **Vercel AI SDK 7** + `@ai-sdk/anthropic` / `openai` / `google` | El encargo exige multiproveedor; el SDK unifica streaming, salida estructurada (Zod) y multimodal. Modelo por defecto: **Claude Opus 5.5** (configurable por variable). |
| Repetición espaciada | **ts-fsrs 6 (FSRS-6)** | Mejor que SM-2 en los benchmarks abiertos (open-spaced-repetition/srs-benchmark): menos repasos para la misma retención. |
| Documentos | **unpdf** (PDF.js serverless), **mammoth** (DOCX) | Puro JS, sin binarios. |
| OCR | **Tesseract 5 local** (spa+cat+eng) vía CLI + **pdftoppm** | Gratis, privado (nada sale del servidor), buena precisión en texto impreso. Descartados por ahora: OCR en la nube (Google Vision, Textract, Azure: coste y datos de menores fuera), tesseract.js (descarga modelos en tiempo de ejecución, más lento). La visión del LLM se reserva para manuscritos cuando haya proveedor. |
| Markdown/fórmulas | react-markdown + remark-math + rehype-katex | Seguro por defecto (sin HTML crudo). |
| Tests | Vitest 5 · Playwright 1.63 | Unit + integración contra Postgres real + E2E contra build de producción. |
| Colas (futuro) | **pg-boss** (sobre Postgres) | Evita Redis para jobs al principio; Redis queda para rate limiting distribuido/caché. |

## 5. Modelo pedagógico

- **Ingesta → mapa de conocimiento**: los títulos detectados (markdown, "Tema N", numeración, MAYÚSCULAS) se convierten en temas; la importancia ≈ proporción del material bajo cada tema; duplicados entre documentos se fusionan por título normalizado.
- **Dominio (mastery)**: estimador bayesiano Beta(1,2) con evidencias ponderadas por formato (ejercicio 1,5 · flashcard 1 · ABCD 0,8 · V/F 0,4), **corrección por azar** (25 % / 50 %) y **decaimiento** (vida media 21 días). Niveles: No iniciado → Principiante → En desarrollo → Casi dominado → **Dominado (exige ≥2 formatos y evidencia suficiente)**. **Laguna** = p < 0,4 con evidencia ≥ 2,5 (nunca un fallo aislado).
- **Decisión** (`decideNextStep`): aprender · practicar · evaluar (si el buen resultado tiene poca evidencia o un único formato) · explicar de otra forma (3 fallos seguidos) · avanzar.
- **Planificador**: prioridad = importancia × (1 − dominio) × 1,5 si laguna; repasos espaciados a +1/+3/+7 días; simulacro la víspera; respeta minutos diarios; se recalcula al subir apuntes, entregar cuestionarios o cambiar ajustes. Cada ítem guarda su motivo.
- **FSRS consciente del examen**: nunca programa un repaso después de la fecha del examen.
- **Gamificación** (`learning/gamification.ts`): premia constancia y mejora real. Tope diario de XP por actividad; XP de mejora idempotente (una vez por logro); racha con 1 día de descanso semanal; retos diarios persistidos y medidos con evidencias; insignias por logros, nunca por tiempo conectado; desactivable por el estudiante.
- **Tutor**: 4 modos (Explicar con 6 estilos, Resolver en 7 pasos, Socrático, Práctica con clasificación del error). Citas `[n]` a fragmentos reales; modo "solo mis apuntes".

## 6. RAG y documentos (Fase 11)

Pipeline implementado: recepción → validación (magic bytes, 15 MB, dimensiones de imagen, duplicado por SHA-256) → extracción (por página en PDF) → **OCR de imágenes y de páginas sin texto** (Tesseract, confianza por documento) → chunking por estructura (≈1200 caracteres, solape 150) → escaneo anti-injection → índice FTS (`tsvector` generado, español, GIN) → embeddings opcionales (HNSW coseno) → temas.
Recuperación: **híbrida FTS + vectorial con Reciprocal Rank Fusion**, con fallback OR para preguntas en lenguaje natural; siempre filtrada por propietario en SQL.

Pendiente: manuscritos con visión del LLM, preprocesado de fotos (enderezado, contraste), PPTX/XLSX, enlaces y vídeo, detección de contradicciones entre fuentes, re-ranking, procesamiento en cola.

## 7. Costes estimados de IA

Precios de lista de Anthropic (consultados en la referencia de la API, oct. 2026; **verificar antes de fijar precios**): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0,10/$0,50 por millón de tokens de entrada/salida.

| Operación (estimación) | Tokens in/out | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|---|
| Turno de tutora (6 fuentes + historial) | 6k / 0,8k | ~$0,040 | ~$0,020 | ~$0,001 |
| 15 flashcards o 10 preguntas | 8k / 2k | ~$0,072 | ~$0,036 | ~$0,002 |
| Estudiante activo/mes (100 turnos + 10 generaciones) | — | **~$4,7** | ~$2,4 | ~$0,12 |

Palancas: prompt caching del system prompt y las fuentes, Haiku/Sonnet para generación masiva tras evaluar la calidad (decisión de producto: el MVP usa Opus 5.5 por defecto), límites diarios por plan (`AI_DAILY_LIMIT_FREE`), y registro de consumo por operación (`ai_usage`; los fallos no se facturan).
Infraestructura MVP: un Postgres gestionado (~$25–50/mes) + hosting Next.js. Voz (STT/TTS) y podcasts: se presupuestarán en su fase con precios verificados.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Alucinaciones / contenido no respaldado | Modo solo fuentes, citas obligatorias, generación con `source` por elemento, evals (AI_EVALUATION.md) |
| Prompt injection desde documentos | Fuentes como datos delimitados y neutralizados, detección, sin herramientas con efectos |
| Menores de edad (ESO) | RGPD + LOPDGDD: consentimiento parental < 14 años en España; minimización de datos; ver SECURITY.md |
| Coste de IA descontrolado | Cuotas, registro por operación, modelos configurables, caching |
| PDFs escaneados / fotos | OCR local (v0.3); confianza visible; manuscritos con visión del LLM cuando haya proveedor |
| Currículos oficiales inventados | Solo fuentes institucionales (BOE, boletines autonómicos) o temario aportado por el usuario |
| Rate limit en memoria (un proceso) | Redis/Upstash al escalar horizontalmente |
| Dependencia de un proveedor | Registro multiproveedor por configuración |

## 9. Roadmap (orden obligatorio del encargo)

| Fase | Estado |
|---|---|
| 0–1 Auditoría, investigación, skills, agentes, MCP | ✅ (instalación de plugins del catálogo pendiente de tu confirmación) |
| 2–3 Arquitectura y diseño visual | ✅ sistema de diseño propio, claro/oscuro, responsive |
| 4–8 BD, auth, dashboard, documentos, tutor | ✅ MVP + OCR (v0.3) + email: recuperación de contraseña y verificación (v0.6) |
| 9 Exam Prep (plan) | ✅ plan adaptativo; falta estimación por horas totales y exámenes anteriores |
| 10 Herramientas | ✅ flashcards FSRS, ABCD, V/F · ⏳ Smart Text, ejercicios con rúbrica, podcasts |
| 12 Motor adaptativo | ✅ v1 (dominio + decisiones + lagunas) · ⏳ grafo de prerrequisitos |
| 13 Simulacros | ✅ examen escrito cronometrado (v0.2, sin IA: ABCD y V/F) · ⏳ preguntas abiertas con rúbrica (requiere IA), examen oral |
| 15 Voz y podcasts | ⏳ |
| 16 Gamificación | ✅ v0.4: XP con tope diario e idempotente, niveles, racha con descanso, retos diarios, insignias, página Logros, opción de ocultar |
| 17 Monetización (Stripe) | ⏳ planes free/premium y cuotas por plan ya aplicados; falta el cobro con Stripe |
| 18 Admin | ✅ v0.5: roles admin/support, usuarios (rol, plan, suspensión), consumo y coste de IA, configuración en BD, errores y auditoría |
| 19–21 Testing, optimización, despliegue | 🟡 tests en CI; despliegue pendiente de autorización |
