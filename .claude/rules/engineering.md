# Ingeniería
- Next.js 16: el middleware se llama `proxy.ts`; leer `node_modules/next/dist/docs/` ante dudas (ver AGENTS.md).
- AI SDK v7: salida estructurada con `generateText({ output: Output.object({ schema }) })` (`generateObject` está obsoleto).
- Lógica pura fuera de componentes y servicios; los servicios no importan React.
- Migraciones: editar `src/db/schema.ts` → `pnpm db:generate` → revisar SQL → `pnpm db:migrate`.
- Dependencias nuevas: justificar en `SKILLS_AND_TOOLS.md` (versión, procedencia, mantenimiento).
- Definición de terminado: implementado + integrado + test (unit/integración/E2E según capa) + docs.
