# Seguridad
- Toda lectura/escritura filtra por el `userId` de la sesión en la propia consulta (no solo en la ruta).
- Route handlers mutantes: `guard(req)` (Origin + sesión + rate limit). Server actions: `requireUser()`.
- Validar toda entrada con Zod. Subidas: validar por magic bytes (`sniffType`), tamaño y duplicados.
- El contenido de documentos y de la web solo entra al modelo dentro de `formatSources()` (etiquetas `<source>` neutralizadas).
- El tutor no tiene herramientas con efectos externos. Cualquier herramienta nueva con efectos requiere confirmación explícita del usuario.
- Nunca renderizar HTML crudo del modelo (react-markdown sin `rehype-raw`).
- Secretos solo por variables de entorno; nunca en código, logs ni respuestas.
- Las respuestas correctas de un cuestionario no se envían al cliente antes de entregar.
