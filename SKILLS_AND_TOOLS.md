# Skills, agentes, MCP y herramientas

Criterio: **instalar solo lo justificado por una necesidad concreta del proyecto**, verificando procedencia, permisos y mantenimiento. Fecha de revisión: 2026-11-09.

## 1. Skills de Claude Code

### Disponibles en la sesión (integradas, Anthropic)
| Skill | Uso en el proyecto |
|---|---|
| `claude-api` | Consultada para modelos, precios y prompt caching de Claude (sección de costes). |
| `code-review`, `security-review`, `simplify` | Revisión de cambios antes de cada release. |
| `run` | Arrancar y verificar la app. |

### Plugins del catálogo recomendados (pendientes de que los actives en claude.ai)
| Plugin | Editor / nivel | Justificación | Decisión |
|---|---|---|---|
| `frontend-design` | Anthropic (oficial) | Calidad de UI/UX y diseño de componentes | **Recomendado** |
| `playwright` (MCP) | Microsoft (partner) | Navegación y pruebas E2E guiadas por el agente | **Recomendado** (además configurado en `.mcp.json`) |
| `supabase` | Supabase (partner) | Solo si se elige Supabase como hosting de Postgres/Storage | Opcional |
| Claude Education Skills Library | Comunidad (165 skills) | Diseño instruccional: rúbricas, recuperación, socrático, espaciado | **Evaluar**: usar solo skills concretas (p. ej. `retrieval-practice-generator`, `socratic-questioning-sequence-generator`, `criterion-referenced-rubric-generator`) |
| Security Audit Loop / Verified Security Sweep | Comunidad | Auditorías de seguridad repetibles | Opcional antes del lanzamiento |

Descartados: plugins con hooks privilegiados de terceros sin revisión (p. ej. hooks `PreToolUse` que se ejecutan en cada acción) y skills de dominios ajenos (Terraform, etc.).

### Skills propias del proyecto (`.claude/skills/`)
| Skill | Propósito | Mantenimiento |
|---|---|---|
| `pedagogy-review` | Checklist de ciencia del aprendizaje para cambios en tutor, material y modelo de dominio | Actualizar al añadir formatos (ejercicios, oral) |
| `rag-safety` | Checklist anti prompt-injection y aislamiento de datos en RAG | Actualizar al añadir herramientas al tutor |

## 2. Agentes especializados (`.claude/agents/`)
`architect`, `frontend`, `backend`, `ai-engineer`, `pedagogy`, `database`, `security`, `qa`, `devops`. Cada uno define responsabilidades, **criterios de aceptación** y límites (sin acciones destructivas ni costes sin autorización).

## 3. Reglas y hooks
- `.claude/rules/` — `security.md`, `pedagogy.md`, `engineering.md` (referenciadas desde `CLAUDE.md`).
- `.claude/settings.json`:
  - **PreToolUse** `guard-secrets.sh`: bloquea escribir claves de API en archivos (probado: devuelve exit 2 con una clave `sk-ant-…`).
  - **PostToolUse**: typecheck tras cada edición (aviso no bloqueante).
  - Permisos: permite test/lint/build; **deniega** `drizzle-kit push` y leer `.env.local`.

## 4. MCP (`.mcp.json`)
| Servidor | Versión | Procedencia | Permisos | Estado |
|---|---|---|---|---|
| Playwright MCP | `@playwright/mcp@0.0.83` (fijada; publicada 2026-09-28) | microsoft/playwright-mcp | Navegador headless aislado (`--isolated`) | Configurado, requiere aprobación (`enableAllProjectMcpServers: false`) |

Evaluados y **no instalados**:
- **GitHub**: ya cubierto por la CLI `gh` del entorno (sin servidor extra).
- **Documentación**: Next.js 16 incluye su documentación en `node_modules/next/dist/docs` (usada durante el desarrollo).
- **Postgres MCP**: el servidor de referencia de `modelcontextprotocol` está archivado; acceso a BD vía `psql`/Drizzle es suficiente y más seguro.
- **Supabase / Stripe / Vercel (conectores)**: disponibles en el directorio; se activarán en las fases de despliegue y monetización.

## 5. Dependencias de la aplicación
| Paquete | Versión | Uso | Procedencia |
|---|---|---|---|
| next / react / react-dom | 16.4.5 / 19.3.0 | Framework | Vercel / Meta |
| ai, @ai-sdk/{anthropic,openai,google} | 7.0 / 4.0 | Capa multiproveedor LLM y embeddings | Vercel |
| better-auth (+ @better-auth/drizzle-adapter) | 1.7.18 | Autenticación | better-auth (OSS, MIT) |
| drizzle-orm / drizzle-kit | 0.45 / 0.31 | ORM y migraciones | Drizzle Team |
| pg | 8.23 | Driver Postgres | node-postgres |
| ts-fsrs | 6.0 | FSRS-6 | open-spaced-repetition |
| unpdf / mammoth | 2.1 / 1.13 | Extracción PDF / DOCX | unjs / mwilliamson |
| zod | 4.6 | Validación | colinhacks |
| react-markdown, remark-gfm, remark-math, rehype-katex, katex | 10 / 4 / 6 / 7 / 0.19 | Render seguro de Markdown y fórmulas | remarkjs / KaTeX |
| lucide-react, clsx, tailwind-merge, tailwindcss | — | UI | OSS |
| vitest, @playwright/test (1.63.0, igual que el navegador preinstalado), tsx | — | Tests | OSS |

Retirada: `motion` (sin uso). Mantenimiento: `pnpm outdated` mensual; actualizar Next/AI SDK leyendo sus guías de migración; `pnpm audit` en CI.

## 6. Paquetes del sistema
`postgresql-16-pgvector` (apt). OCR: `tesseract-ocr` 5.3.4 + `tesseract-ocr-spa`, `-cat` (Ubuntu, paquetes oficiales; mantenimiento con las actualizaciones del sistema) y `poppler-utils` (pdftoppm). Incluidos en el Dockerfile y la CI.
