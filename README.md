# Triff

Plataforma de estudio con IA: sube tus apuntes, prepara un examen con un plan adaptativo, aprende con una tutora (explicar, resolver paso a paso, socrático, práctica), repasa con FSRS, haz cuestionarios con fuentes y mide tu dominio real de cada tema.

> Pendiente: comprobar disponibilidad de la marca «Triff» (OEPM / EUIPO) y del dominio.

## Inicio rápido
```bash
pnpm install
cp .env.example .env.local      # configura DATABASE_URL (Postgres 16 + pgvector)
pnpm db:migrate
pnpm dev                        # http://localhost:3000
```
Sin claves de IA la app funciona en **modo sin IA**: genera tarjetas y cuestionarios por extracción literal de tus apuntes y la tutora muestra los fragmentos relevantes con su cita. Añade `ANTHROPIC_API_KEY` (u OpenAI/Google) para activar la IA.

## Scripts
| Script | Qué hace |
|---|---|
| `pnpm dev` / `build` / `start` | Desarrollo / build / producción |
| `pnpm test` | Unit + integración (requiere `TEST_DATABASE_URL`, migrada) |
| `pnpm test:e2e` | E2E Playwright contra el build |
| `pnpm lint`, `pnpm typecheck` | Calidad |
| `pnpm db:generate`, `pnpm db:migrate` | Migraciones |

## Documentación
[Arquitectura](PROJECT_ARCHITECTURE.md) · [Skills y herramientas](SKILLS_AND_TOOLS.md) · [Esquema BD](DATABASE_SCHEMA.md) · [API](API_DOCUMENTATION.md) · [Seguridad](SECURITY.md) · [Despliegue](DEPLOYMENT.md) · [Evaluación IA](AI_EVALUATION.md) · [Changelog](CHANGELOG.md)
