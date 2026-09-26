# ROADMAP.md — EvidenceFit

## Principio general

EvidenceFit crecerá desde un MVP muy pequeño hacia una plataforma B2B más completa.

Cada versión debe:

- mantener funcional el flujo existente;
- introducir una capacidad clara;
- evitar reescrituras innecesarias;
- añadir complejidad únicamente cuando exista una razón;
- producir aprendizaje técnico defendible;
- mantener el producto desplegable.

---

# v0.1 — MVP explicable

## Objetivo

Demostrar el recorrido completo:

```text
vacante
→ requisitos
→ candidato
→ evidencia
→ evaluación
→ explicación
→ comparación
```

## Funcionalidad

### Auth

- registro;
- login;
- JWT.

### Jobs

- crear vacante;
- pegar descripción;
- persistir vacante;
- extraer requisitos con OpenRouter.

### Candidates

- crear candidato;
- pegar CV sintético en texto;
- persistir CV.

### Evaluations

- seleccionar vacante y candidato;
- extraer evidencia;
- mapear evidencia contra requisitos;
- asignar nivel de evidencia;
- calcular score simple;
- mostrar explicación y confianza.

### Comparison

- comparar al menos dos candidatos;
- ordenar resultados;
- inspeccionar evidencia.

## Ingeniería

- pnpm monorepo;
- Next.js;
- NestJS;
- PostgreSQL + Neon + Prisma;
- MongoDB Atlas + Mongoose;
- OpenRouter;
- JWT;
- TypeScript strict;
- ESLint;
- Prettier;
- Jest;
- README;
- deploy público.

## Criterio de salida

Una persona debe poder abrir la demo y completar el flujo principal en pocos minutos.

---

# v0.2 — Ingesta de documentos y UX

## Objetivo

Hacer el producto más cercano al flujo real de recruiting sin cambiar su núcleo.

## Features

- upload de PDF;
- extracción de texto;
- preview del documento;
- validación de archivos;
- límites de tamaño;
- mejor estados loading/error;
- historial básico de evaluaciones;
- mejoras de accesibilidad;
- diseño responsive.

## Ingeniería

- pipeline de parsing desacoplado;
- errores controlados;
- tests de archivos inválidos;
- fixtures sintéticos.

---

# v0.3 — Comparación avanzada

## Objetivo

Hacer que la comparación entre candidatos sea una verdadera herramienta de decisión.

## Features

- comparar múltiples candidatos;
- filtros por requisito;
- mostrar fortalezas;
- mostrar gaps;
- pesos por requisito;
- requisitos obligatorios vs deseables;
- ranking explicable;
- vista lado a lado.

## Ingeniería

- scoring configurable;
- tests determinísticos del ranking;
- documentación de reglas.

---

# v0.4 — Human-in-the-loop

## Objetivo

Permitir que el recruiter corrija y complemente el sistema.

## Features

- aceptar recomendación;
- rechazar recomendación;
- corregir evidencia;
- agregar comentario;
- registrar override humano;
- historial de decisiones.

## Métricas iniciales

- acceptance rate;
- override rate;
- disagreement rate.

## Datos

PostgreSQL debe almacenar feedback estructurado y trazable.

---

# v0.5 — Evaluation Harness

## Objetivo

Dejar de evaluar la IA "a ojo" y empezar a medirla.

## Dataset

Crear dataset sintético versionado con:

- job descriptions;
- candidatos;
- evidencia esperada;
- casos positivos;
- casos negativos;
- información ausente.

## Métricas

### Evidence precision

¿La evidencia citada realmente existe?

### Requirement coverage

¿Qué porcentaje de requisitos pudo resolverse?

### Explanation grounding

¿Qué porcentaje de afirmaciones apunta a evidencia concreta?

### Hallucination rate

¿El modelo inventó skills o experiencia?

### Ranking consistency

¿Cambios irrelevantes cambian el ranking?

### Latency

p50 / p95.

### Cost

tokens y costo por evaluación.

## Tests sugeridos

```text
same_candidate_different_cv_format
same_experience_different_wording
skill_mentioned_without_evidence
skill_with_recent_project_evidence
missing_information_returns_unknown
irrelevant_keyword_stuffing
spanish_vs_english_equivalence
contradictory_employment_dates
```

---

# v0.6 — Seguridad de IA

## Objetivo

Probar que los documentos analizados son datos no confiables.

## Features

- detección/mitigación de prompt injection;
- separar instrucciones del sistema y contenido del CV;
- sanitización de documentos;
- límites de input;
- validación estricta de outputs;
- fallback cuando output no cumple schema;
- rate limits;
- retries controlados;
- timeout por request.

## Tests

```text
prompt_injection_inside_cv
malformed_ai_output
oversized_document
provider_timeout
provider_unavailable
```

---

# v0.7 — Auditoría y reproducibilidad

## Objetivo

Poder responder:

> ¿Por qué el sistema tomó esta decisión y con qué configuración?

## Guardar metadata

```json
{
  "modelVersion": "...",
  "promptVersion": "...",
  "taxonomyVersion": "...",
  "inputHash": "...",
  "score": 0.82,
  "confidence": 0.76,
  "evidenceIds": []
}
```

## Features

- audit log;
- versión de prompt;
- versión de modelo;
- versión de reglas;
- timestamp;
- correlación de requests;
- reproducibilidad parcial.

---

# v0.8 — Organizaciones y RBAC

## Objetivo

Transformar el demo individual en una base B2B.

## Entidades

- organization;
- user;
- membership;
- role.

## Roles iniciales

- admin;
- recruiter;
- viewer.

## Features

- aislamiento lógico por organización;
- permisos;
- ownership de vacantes;
- ownership de candidatos;
- auditoría por usuario.

## Seguridad

- verificar autorización a nivel de servicio;
- evitar IDOR;
- tests de aislamiento entre organizaciones.

---

# v0.9 — Operación y escalabilidad

## Objetivo

Preparar el producto para cargas más realistas sin abandonar el monolito modular prematuramente.

## Posibles mejoras

Implementar únicamente cuando existan métricas que lo justifiquen.

- procesamiento asíncrono;
- job queue;
- retries;
- idempotencia;
- caching;
- rate limiting más completo;
- índices DB;
- profiling;
- tracing;
- métricas de infraestructura.

## Regla

No introducir Redis, queues u otros componentes solo porque aparecen en este roadmap.

Primero medir.

Después decidir.

---

# v1.0 — Producto B2B sólido

## Objetivo

Tener una versión presentable como producto completo de portfolio.

## Capacidades esperadas

### Producto

- organizaciones;
- usuarios;
- roles;
- vacantes;
- candidatos;
- documentos;
- evaluaciones;
- comparación;
- feedback humano;
- historial;
- auditoría.

### IA

- proveedor desacoplado;
- outputs estructurados;
- prompts versionados;
- evaluaciones reproducibles;
- métricas;
- protección básica contra prompt injection.

### Ingeniería

- CI;
- tests;
- documentación;
- migraciones;
- seguridad razonable;
- observabilidad;
- deploy estable.

### Presentación

- demo pública;
- README técnico;
- arquitectura;
- ADRs relevantes;
- dataset sintético;
- evaluation report;
- limitaciones declaradas.

---

# Ideas posteriores a v1.0

Estas features NO forman parte del compromiso inicial.

## Skill normalization

- aliases;
- tecnologías relacionadas;
- recencia;
- duración;
- profundidad.

## Multilenguaje

- español;
- inglés;
- consistencia entre idiomas.

## Recruiter dashboard

- funnel;
- time-to-shortlist;
- override rate;
- evaluation quality;
- model drift.

## Privacy controls

- data retention;
- export;
- delete;
- consent;
- purpose limitation.

## Proveedores IA adicionales

- Gemini;
- OpenAI;
- Anthropic;
- modelos locales.

## Evaluaciones más profundas

- bias harness;
- robustness tests;
- drift;
- regression suite de prompts.

---

# Orden de prioridad

Si existe poco tiempo, priorizar siempre:

```text
1. flujo end-to-end
2. explicabilidad
3. tests
4. deploy
5. documentación
6. nuevas features
```

No romper v0.1 para perseguir v1.0.

El proyecto debe permanecer demostrable después de cada fase.
