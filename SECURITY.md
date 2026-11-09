# Seguridad y privacidad

## Controles implementados (v0.1)
| Amenaza | Control | Dónde | Probado |
|---|---|---|---|
| Acceso a datos ajenos (IDOR) | Toda consulta filtra por `userId` de la sesión en SQL | `src/lib/services/*`, rutas | Integración: otro usuario no puede ingerir ni recuperar |
| CSRF | Server actions (protección de Next) + `Origin` == host en rutas + cookies `SameSite=Lax` | `src/lib/http.ts` | E2E: 403 con Origin ajeno |
| XSS | React escapa; Markdown sin HTML crudo; enlaces `noopener nofollow`; cabeceras `X-Content-Type-Options`, `X-Frame-Options: DENY` | `markdown.tsx`, `next.config.ts` | — |
| Fuerza bruta / abuso | Rate limit de Better Auth (30/min, más estricto en registro e inicio de sesión) + limitador por usuario y ruta. `AUTH_RATE_LIMIT=off` existe **solo** para el servidor de E2E; nunca en producción | `auth/server.ts`, `usage.ts` | — |
| Sesiones | Cookies httpOnly, `Secure` en producción, caducidad 14 días | Better Auth | — |
| Contraseñas | 10–128 caracteres, hash scrypt (Better Auth) | | E2E registro |
| Subidas maliciosas | Magic bytes, 15 MB, UTF-8 estricto para texto, nombre saneado, deduplicación SHA-256; no se guarda el binario | `extract.ts`, `documents.ts` | Unit + integración |
| Bombas de descompresión / abuso de CPU en OCR | Dimensiones leídas de la cabecera (máx. 40 MP, 12 000 px por lado) antes de decodificar; máx. 25 páginas de OCR; tiempo máximo de 60 s por página; `OMP_THREAD_LIMIT=1` | `image-size.ts`, `ocr.ts` | Unit + integración |
| Inyección de comandos en OCR | `execFile` sin shell y argumentos fijos; los nombres de archivo del usuario nunca llegan a la línea de comandos; directorio temporal privado (`mkdtemp`) borrado en `finally` | `ocr.ts` | Revisión de código |
| Prompt injection (documentos) | Fuentes como datos delimitados y neutralizados, instrucción explícita en el system prompt, detección y marcado `suspicious`, tutor sin herramientas con efectos | `injection.ts`, `prompts.ts` | Unit + integración con fixture malicioso |
| Fuga de respuestas | Las respuestas correctas solo se envían tras entregar | `quiz/[id]/page.tsx` | E2E |
| Secretos | Solo variables de entorno; hook que bloquea escribir claves; `.env*` ignorados | `.claude/hooks` | Hook probado |
| Coste / abuso de IA | Cuota diaria, registro por operación, fallos no facturables | `usage.ts` | Integración (sin IA no se registra consumo) |
| Auditoría | `audit_log`: ingesta y todas las acciones de administración, con actor y valores antes/después | `services/admin.ts`, `services/settings.ts` | Integración + E2E |
| Escalada de privilegios | Roles `student`/`support`/`admin` con permisos explícitos; el primer admin solo por CLI; sin auto-promoción, auto-degradación ni auto-suspensión; siempre ≥ 1 admin activo; permisos comprobados en acción y servicio; `/admin` responde 404 a no staff | `lib/admin/permissions.ts`, `services/admin.ts` | Unit + integración + E2E |
| Cuentas suspendidas | Se borran sus sesiones, `getUser` las rechaza aunque tengan cookie, y un hook de Better Auth impide crear sesiones nuevas | `auth/server.ts`, `auth/session.ts` | Integración + E2E |
| Privacidad en el panel | Solo agregados y metadatos; nunca contenido de apuntes, conversaciones o respuestas. Las claves de API nunca se muestran (solo «configurada / sin clave») | `services/admin.ts` | Revisión + E2E |

| Recuperación de cuenta | Enlace de un solo uso (30 min), revocación de todas las sesiones al cambiar la contraseña, aviso por correo, sin enumeración de cuentas (respuesta idéntica y envío sin esperar), 3 solicitudes/15 min por IP | `auth/server.ts`, `email/*` | Integración + E2E |
| Correos | Plantillas con escapado y solo enlaces http(s); en producción no se almacena el contenido; la bandeja local está prohibida en producción salvo en el servidor de E2E (`ALLOW_TEST_OUTBOX=1`) | `email/templates.ts`, `email/send.ts` | Unit + integración |

## Pendiente antes de producción
- Configurar Resend con un dominio propio verificado (SPF, DKIM y DMARC) para que los correos no acaben en spam.
- Rate limiting distribuido (Redis) si hay más de una instancia.
- CSP estricta con nonces.
- Almacenamiento de originales (S3 compatible) cifrado en reposo con URLs firmadas, si se decide conservarlos.
- Panel de privacidad: exportar y borrar cuenta (el borrado en cascada ya existe en el esquema).
- Pentest y escaneo de dependencias (`pnpm audit`) en CI.

## RGPD y menores
- Base jurídica: ejecución del contrato (servicio) y consentimiento (analítica, si se añade).
- **Menores**: en España (LOPDGDD art. 7) el consentimiento propio es válido desde los **14 años**; por debajo hace falta el de madre, padre o tutor. Para ESO se requiere: verificación de edad en el registro, flujo de consentimiento parental, sin publicidad ni perfilado comercial, y minimización de datos.
- Proveedores de IA como encargados del tratamiento: firmar DPA, preferir regiones UE o retención cero cuando esté disponible, y no usar los datos para entrenar modelos.
- Retención: documentos y conversaciones mientras la cuenta esté activa; registros de uso de IA 24 meses (propuesta, a validar con asesoría legal).
- AI Act (UE): los sistemas de IA que **evalúan** resultados de aprendizaje en educación pueden ser de alto riesgo; las calificaciones de Triff son **orientativas** y así se indica. Revisar con asesoría legal antes de usarlas para evaluaciones con efectos académicos.

## Notificar una vulnerabilidad
Abrir un aviso privado de seguridad en el repositorio (no un issue público).
