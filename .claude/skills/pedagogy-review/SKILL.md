---
name: pedagogy-review
description: Revisa material o lógica educativa de Triff (prompts del tutor, cuestionarios, flashcards, plan, modelo de dominio) contra principios de ciencia del aprendizaje. Úsala al cambiar src/lib/learning/, src/lib/ai/prompts.ts o la generación de material.
---

# Revisión pedagógica

Comprueba, citando archivo y línea:

1. **Práctica de recuperación**: las flashcards piden recordar (no reconocer); una idea por tarjeta.
2. **Espaciado**: el repaso usa FSRS y no programa repasos tras el examen.
3. **Feedback elaborado**: cada pregunta explica por qué la correcta lo es y por qué fallan los distractores; cita la fuente.
4. **Distractores**: plausibles, homogéneos en longitud y forma, basados en errores conceptuales típicos; sin "todas las anteriores".
5. **Andamiaje**: Socrático da pistas graduadas y no revela la solución; Solver justifica cada paso y comprueba el resultado.
6. **Validez del dominio**: evidencias de ≥2 formatos para "Dominado"; corrección por azar en V/F y ABCD; un fallo aislado no es laguna.
7. **Fidelidad a fuentes**: con `sourcesOnly` no hay contenido sin respaldo.
8. **Carga cognitiva**: explicaciones adaptadas al nivel; sin párrafos enormes.
9. **Motivación sana**: nada premia tiempo conectado por sí mismo.

Salida: lista de hallazgos (crítico / mejora / correcto) con propuesta concreta y, cuando sea lógica pura, el test que lo verificaría.
