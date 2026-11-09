# Despliegue

## Requisitos
- Node.js 22, pnpm 10
- PostgreSQL 16 con la extensión **pgvector** (Supabase, Neon, RDS, Cloud SQL o `pgvector/pgvector:pg16`)
- Variables de entorno: ver `.env.example` (`BETTER_AUTH_SECRET` aleatorio de ≥32 caracteres; `BETTER_AUTH_URL` = URL pública)

## Local
```bash
cp .env.example .env.local   # y ajusta DATABASE_URL
pnpm install
pnpm db:migrate
pnpm dev
```
La primera migración ejecuta `CREATE EXTENSION IF NOT EXISTS vector` (el rol necesita permiso o la extensión ya creada).

## Producción
1. `pnpm db:migrate` contra la BD de producción (paso explícito del pipeline; nunca `drizzle-kit push`).
2. `pnpm build && pnpm start`, o la imagen `Dockerfile` (no verificada en este entorno: Docker sin daemon).
3. Vercel: funciona sin cambios (rutas con `maxDuration` 120 s para ingesta y tutor). Postgres gestionado externo.
4. Activar IA: `AI_PROVIDER` + clave; embeddings opcionales con `EMBEDDINGS_PROVIDER`.
5. **Email**: crea una cuenta en Resend, verifica tu dominio (registros SPF/DKIM/DMARC) y define `RESEND_API_KEY` y `EMAIL_FROM`. Sin ellos, la recuperación de contraseña no funcionará en producción (el panel lo avisa).
6. **OCR**: requiere los binarios `tesseract` (con `spa`/`cat`) y `pdftoppm`, incluidos en el `Dockerfile`. En plataformas sin ellos (p. ej. Vercel serverless) el OCR se desactiva automáticamente y se informa al usuario; para tenerlo allí, mover la ingesta a un worker con la imagen Docker (previsto con la cola pg-boss).

## Primer administrador
Tras desplegar y registrarte en la web, en el servidor:
```bash
pnpm admin:role tu-correo@ejemplo.com admin
```
(`admin:role` lee `.env.local`; en otros entornos ejecuta `pnpm exec tsx scripts/admin-role.mts <email> admin` con `DATABASE_URL` definida.)

## CI
`.github/workflows/ci.yml`: lint → typecheck → migraciones → unit/integración → build → E2E (Postgres pgvector como servicio).

## Observabilidad (siguiente fase)
Logs estructurados, OpenTelemetry (AI SDK lo soporta), alertas de coste sobre `ai_usage`, Sentry para errores de cliente.

> Ningún despliegue ni recurso de pago se ha creado: requiere tu autorización.
