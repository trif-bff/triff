# Próximos pasos (estado al 2026-11-09)

Última versión publicada: **0.6.0** (email). Todo está en `main` y los tests están en verde (111 Vitest + 18 E2E).

## Fase en curso: currículos oficiales (no empezada en código)

Hecho:
- Entorno cloud personal **«triff»** creado, con acceso de red a `www.boe.es` y un script de preparación (pgvector, Tesseract, bases de datos, dependencias, migraciones y `.env.local`). El script no se ha probado todavía en una sesión nueva: comprobar al arrancar.
- Verificada la estructura XML del BOE (`https://www.boe.es/diario_boe/xml.php?id=<ID>`): párrafos `<p class="...">`.
  - **ESO**: Real Decreto 217/2022, `BOE-A-2022-4975`. Materias en el anexo II (`centro_negrita` = nombre de la materia) y ámbitos de diversificación en el anexo V.
  - **Bachillerato**: Real Decreto 243/2022, `BOE-A-2022-5521`.
  - **FP Administración y Finanzas**: Real Decreto 1584/2011. Falta localizar su ID en el BOE.
- Estructura de cada materia LOMLOE:
  - «Competencias específicas.»: `N. texto`, seguida de párrafos descriptivos;
  - grupos de curso (`centro_cursiva` o `centro_redonda`, p. ej. «Cursos de primero a tercero», «MATEMÁTICAS A»);
  - «Criterios de evaluación»: «Competencia específica N.» y después `N.M texto`;
  - «Saberes básicos.»: bloques `A. …`, sub-bloques `1. …` y elementos `− …`.

Plan:
1. Parser puro `src/lib/curriculum/boe-parser.ts`, con tests sobre un extracto real del XML guardado como fixture. Copia **literal**: nada de resumir ni de usar IA.
2. Script `scripts/import-boe-curriculum.mts <BOE-ID>` que genere JSON en `data/curricula/` (versionado en Git; los textos legales no tienen propiedad intelectual, art. 13 de la LPI) y comando para cargarlo en la BD de forma idempotente.
3. Tablas `curricula` (país, región, etapa, curso, materia, referencia, URL y fecha de la fuente, oficial o del usuario) y `curriculum_items` (competencia, criterio, bloque, saber, resultado de aprendizaje (RA), criterio de FP, tema).
4. Vincular una asignatura a un currículo y crear sus temas a partir de los bloques de saberes (o de los RA en FP). Mostrar siempre la fuente oficial con enlace.
5. «Temario propio»: el usuario pega una lista (con sangría para los subtemas) y se convierte en temas.
6. Límite honesto: solo enseñanzas mínimas estatales. Los decretos autonómicos (p. ej. Cataluña, en el DOGC) requieren su propia fuente y acceso de red.

## Pendiente después
- Stripe (cobro de los planes).
- Resend real (falta dominio y clave).
- Funciones que necesitan clave de IA: podcasts, examen oral, preguntas abiertas con rúbrica, manuscritos con visión.
- Despliegue en producción (requiere autorización).
