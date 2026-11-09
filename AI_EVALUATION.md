# Evaluación de calidad pedagógica e IA

Una funcionalidad de IA no está terminada porque "responda": debe medirse. Este documento separa lo **verificado** de lo **pendiente de medir con un proveedor real**.

## 1. Verificado automáticamente (sin IA, deterministas)
| Dimensión | Cómo se comprueba | Test |
|---|---|---|
| Fidelidad a las fuentes (modo sin IA) | Cada definición extraída aparece literalmente en los apuntes | `tests/unit/learning.test.ts` › extracts literal definitions only |
| Trazabilidad | Toda tarjeta/pregunta guarda `sourceChunkId`; la explicación cita el texto | unit + integración |
| Validez de preguntas | Índices correctos dentro de rango, opciones únicas, V/F con 2 opciones, mezcla de formatos | unit |
| Validez de la corrección | Única/múltiple, crédito parcial, "marcar todo" puntúa 0 | unit › grading |
| Repetición espaciada | Intervalos crecen al acertar, se reducen al fallar, nunca tras el examen | unit › FSRS |
| Modelo de dominio | Fallo aislado ≠ laguna; corrección por azar; ≥2 formatos para "Dominado"; decaimiento; un único cuestionario no da "casi dominado" | unit › mastery |
| Adaptación | Laguna detectada → plan prioriza el tema con motivo "Laguna"; 3 fallos → "explicar de otra forma" | integración › adaptive loop |
| Recuperación | Pregunta en lenguaje natural recupera el fragmento correcto (stemming español) y respeta propietario | integración › retrieval |
| Prompt injection | Documento malicioso marcado como sospechoso; el envoltorio `<source>` no se puede cerrar desde el texto | unit + integración |

| Simulacro: cobertura y pesos | Reparto exacto, proporcional a la importancia, cubre todos los temas con material, nunca supera el material disponible | `tests/unit/mock-exam.test.ts` |
| Simulacro: validez de la nota | Escala 0–10, sin respuesta ≠ evidencia, comparación con el anterior, retraso con el reloj del servidor | unit + integración + E2E |

| OCR | Foto y PDF escaneado de apuntes en español: texto recuperado (confianza > 80 %), temas detectados, citas con página correcta, material generado a partir del texto; imágenes en blanco y bombas rechazadas | `tests/unit/ocr.test.ts`, `tests/integration/ocr.test.ts`, E2E |

**Pendiente de medir (OCR):** precisión sobre un corpus real (apuntes impresos fotografiados con móvil, fotocopias, manuscritos) con CER/WER por tipo. Las fixtures actuales son texto impreso renderizado; no demuestran la calidad con letra manuscrita.

| Gamificación sin efectos perversos | Tope diario de XP, idempotencia de logros (caer y recuperar no paga dos veces), retos medidos con evidencias reales, racha con descanso, insignias por logros | `tests/unit/gamification.test.ts`, `tests/integration/gamification.test.ts`, E2E |

Resultado actual: **88 tests de Vitest + 10 E2E de Playwright en verde** (más 1 E2E solo móvil omitido en escritorio).

## 2. Pendiente de medir con proveedor de IA (requiere tu autorización por coste)
Conjunto propuesto de evaluación (`evals/`, a crear):
1. **Exactitud**: 50 preguntas con respuesta de referencia por asignatura (matemáticas, física, química, lengua, economía, contabilidad). Métrica: exactitud evaluada por rúbrica + revisión humana del 20 %.
2. **Coherencia con documentos** (modo solo fuentes): 30 preguntas *fuera* del temario → la respuesta correcta es "no está en tus apuntes". Métrica: tasa de abstención correcta ≥ 95 %; citas `[n]` que existen y respaldan la afirmación ≥ 90 %.
3. **Calidad de preguntas generadas**: rúbrica de 5 criterios (una sola respuesta defendible, distractores plausibles, sin pistas gramaticales, nivel cognitivo declarado, fuente correcta) puntuada por un juez LLM y calibrada con 2 revisores humanos (acuerdo κ ≥ 0,6).
4. **Validez de correcciones** (respuestas abiertas, Fase 10.5): concordancia con nota de docente en 100 respuestas; MAE ≤ 1 punto sobre 10.
5. **Modo socrático**: en 20 diálogos simulados, la solución no se revela antes de que el estudiante la proponga (0 fugas).
6. **Solver**: presencia de los 7 apartados y comprobación correcta en 30 ejercicios con solución conocida.
7. **Robustez a injection**: 25 documentos adversarios (ES/EN); 0 cambios de rol u obediencia a instrucciones embebidas.
8. **Consistencia**: misma pregunta 5 veces → misma nota en correcciones (desviación ≤ 0,5).

Coste estimado de una pasada completa con Opus 5.5: del orden de 5–15 USD (≈300 llamadas). Se ejecutará solo con autorización.
