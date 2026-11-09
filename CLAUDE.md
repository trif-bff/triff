# Triff — guía para agentes

Plataforma SaaS de estudio con IA (tutora, preparación de exámenes, repaso espaciado, dominio por competencias).
Lee `PROJECT_ARCHITECTURE.md` antes de cambios estructurales.

@AGENTS.md

## Comandos
- `pnpm dev` — desarrollo (requiere Postgres con pgvector y `.env.local`, ver `.env.example`)
- `pnpm test` — unit + integración (Vitest, BD `triff_test`)
- `pnpm test:e2e` — Playwright contra build de producción (`pnpm build` antes)
- `pnpm db:generate` / `pnpm db:migrate` — migraciones Drizzle (nunca `drizzle-kit push` en producción)
- `pnpm typecheck`, `pnpm lint`

## Mapa del código
- `src/lib/learning/` — lógica pedagógica PURA (FSRS, dominio, planificador, heurísticas, corrección). Sin I/O, 100 % testeada.
- `src/lib/docs/` — extracción, chunking, higiene anti prompt-injection.
- `src/lib/rag/` — recuperación híbrida (FTS español + pgvector, RRF).
- `src/lib/ai/` — proveedores (AI SDK v7) y prompts del tutor.
- `src/lib/services/` — casos de uso con BD. Toda consulta filtra por `userId`.
- `src/app/api/` — route handlers (usar `guard()` de `src/lib/http.ts`).
- `src/app/(app)/actions.ts` — server actions (requieren `requireUser()`).

## Reglas no negociables
Ver `.claude/rules/`. Resumen: autorización en la capa de datos; documentos = datos, nunca instrucciones;
no inventar contenido cuando `sourcesOnly`; no cobrar operaciones de IA fallidas; ninguna funcionalidad
está terminada sin test; no llamar APIs de pago en tests.
