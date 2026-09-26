# Arquitectura inicial

EvidenceFit comienza como un monolito modular. `apps/web` presenta la interfaz y `apps/api`
concentra los límites de dominio, persistencia, autenticación e integración con IA.

```text
apps/web (Next.js: jobs + candidates + evaluations)
        │
        ├── cookie httpOnly + BFF /api/backend
        │
        | REST + Bearer JWT
        v
apps/api (NestJS)
  ├── auth ─────────> bcrypt + JWT + Prisma/PostgreSQL (User)
  ├── jobs ─────────> Prisma/PostgreSQL (Job)
  │    │
  │    ├────────────> AiProvider ──> OpenRouterProvider
  │    └────────────> Mongoose/MongoDB (job_requirement_extractions)
  ├── candidates ──> Prisma/PostgreSQL (Candidate + cvText original)
  │    │
  │    ├───────────> AiProvider ──> OpenRouterProvider
  │    └───────────> Mongoose/MongoDB (candidate_evidence_extractions)
  ├── evaluations ──> MatchingService (reglas deterministas)
  │    ├────────────> Prisma/PostgreSQL (Evaluation)
  │    └────────────> Mongoose/MongoDB (evaluation_results)
  │         └───────> ComparisonService (agregación on-demand, solo lectura)
  ├── ai
  └── database ─────> Prisma/PostgreSQL + Mongoose/MongoDB
```

## Decisiones

- No se crean microservicios: los módulos son límites internos dentro de una sola API.
- `Job` se almacena en PostgreSQL porque es una entidad estructurada y será origen de relaciones con
  evaluaciones. La primera migración crea tanto `users` como `jobs`, ya que no existía una migración
  base anterior.
- La extracción vive en `job_requirement_extractions` de MongoDB porque es un documento derivado,
  flexible y reemplazable. `jobId` tiene índice único y referencia el ID relacional a nivel de
  aplicación; no se intenta simular una FK entre motores.
- `Candidate` vive en PostgreSQL porque representa la identidad estable del candidato sintético y
  conserva el `cvText` canónico que servirá para auditoría. La evidencia vive en
  `candidate_evidence_extractions` porque es una interpretación derivada, reejecutable y de forma
  documental. `candidateId` es una referencia lógica única, no una FK entre motores.
- `JobsService` y `CandidatesService` dependen de `AiProvider`, no de OpenRouter.
  `EvaluationsService` no llama al proveedor: consume las extracciones ya validadas y delega en
  `MatchingService`, una capa determinista y testeable.
- Prisma crea el cliente de forma diferida. Mongoose se registra solamente si existe
  `MONGODB_URI`; esto permite validar el esqueleto sin credenciales reales.
- No se crean paquetes compartidos hasta que exista código realmente compartido.
- `JwtAuthGuard` se registra globalmente. Solo `auth/register`, `auth/login` y `health` se marcan
  explícitamente como públicos; no se implementa RBAC en v0.1.
- El navegador no recibe el token mediante JavaScript. Next.js actúa como BFF mínimo: guarda el JWT
  en una cookie `httpOnly`, reenvía las operaciones interactivas y usa `API_URL` únicamente en el
  servidor. NestJS continúa siendo la autoridad que verifica firma y expiración.

## Flujo de autenticación

```text
register/login en Next.js
  → POST NestJS /api/auth/register o /api/auth/login
  → Prisma User en PostgreSQL + bcrypt cost 12
  → JWT firmado con expiración
  → Next.js guarda cookie httpOnly, SameSite=Lax y Secure en producción
  → BFF reenvía Authorization: Bearer <token> a las rutas privadas
```

Los emails se normalizan antes de persistir. Login usa el mismo mensaje para email inexistente y
password incorrecta y ejecuta una comparación bcrypt incluso cuando no encuentra usuario, evitando
el oracle más evidente. Las respuestas nunca incluyen `passwordHash`.

## Flujo de vacantes

```text
POST /api/jobs
  → ValidationPipe + CreateJobDto
  → JobsService
  → Prisma Job

POST /api/jobs/:id/extract-requirements
  → carga Job desde PostgreSQL
  → AiProvider.extractJobRequirements
  → OpenRouter JSON Schema estricto
  → validación runtime + evidencia presente en la descripción
  → upsert MongoDB por jobId
```

La defensa contra requisitos inventados combina instrucciones deterministas con controles locales:

1. temperatura `0` y structured output estricto;
2. campos cerrados y sin propiedades adicionales;
3. `unknown` para nivel/categoría inciertos y `null` para años/obligatoriedad ausentes;
4. `evidenceText` debe ser una cita no vacía presente en la descripción original;
5. outputs inválidos producen `502` y no se persisten.

## Flujo de candidatos

```text
POST /api/candidates
  → ValidationPipe + CreateCandidateDto
  → confirmación isSynthetic=true
  → CandidatesService
  → Prisma Candidate

POST /api/candidates/:id/extract-evidence
  → carga Candidate y cvText desde PostgreSQL
  → AiProvider.extractCandidateEvidence
  → OpenRouter JSON Schema estricto
  → validación runtime + cita presente en el CV
  → upsert MongoDB por candidateId
```

Una skill mencionada no equivale a experiencia. El prompt prohíbe esa inferencia y la validación
local exige que cualquier elemento con `sourceType=skills_section` tenga `evidenceLevel=weak` y
`years=null`. Para toda evidencia, la cita se normaliza solo en Unicode, espacios y mayúsculas antes
de comprobar que pertenece al `cvText`; no se usa similitud semántica para aceptar texto inventado.
Los enums cerrados, rangos de confianza, `unknown`/`null` y el rechazo previo al upsert forman la
segunda barrera independiente del proveedor.

## Flujo de evaluaciones

```text
POST /api/evaluations { jobId, candidateId }
  → valida Job y Candidate en PostgreSQL
  → exige job_requirement_extractions y candidate_evidence_extractions vigentes
  → MatchingService compara cada nombre normalizado
  → calcula estados, faltantes, explicación y score
  → crea Evaluation en PostgreSQL
  → guarda evaluation_results en MongoDB
```

La normalización elimina diferencias de mayúsculas, diacríticos, espacios y puntuación. También
preserva símbolos relevantes antes de normalizar —por ejemplo, C# y C++ no colapsan en C—. No hay
sinónimos ni jerarquías tecnológicas: `Node.js` coincide con `nodejs`, pero JavaScript no coincide
con TypeScript y React no coincide con Next.js.

`not_found` significa que ninguna evidencia tiene el mismo nombre normalizado. `unknown` significa
que sí hay evidencia relacionada, pero su propio nivel no permite concluir. Cuando falta acreditar
años o nivel, la evidencia permanece asociada, se registra el faltante y el estado se limita, sin
convertirlo en `not_found`.

El score es:

```text
strong=1.0, medium=0.7, weak=0.4, unknown=0.2, not_found=0.0
peso obligatorio=2, peso deseable/no indicado=1
score = Σ(valor × peso) / Σ(peso)
```

Es una heurística interna en escala `0..1`; no estima probabilidad de contratación ni precisión del
sistema. El detalle vive en MongoDB porque es documental y derivado. PostgreSQL conserva la entidad
`Evaluation`, las relaciones y el score consultable. Como no existe una transacción distribuida, si
falla el guardado documental el servicio intenta eliminar inmediatamente la fila relacional creada.

## Flujo de comparación

```text
GET /api/jobs/:jobId/comparison?evaluationIds=id1,id2
  → valida Job y exige al menos dos IDs distintos
  → carga Evaluations + nombres de Candidate desde PostgreSQL
  → comprueba que todas existen y pertenecen al Job
  → carga evaluation_results en una consulta MongoDB
  → ordena por score descendente, preservando el orden solicitado en empates
  → agrega los snapshots exactos de requisitos y devuelve resultados lado a lado
```

`ComparisonService` es una proyección de lectura: no existe una entidad ni una colección
`Comparison`. Utiliza exclusivamente evaluaciones ya creadas y no ejecuta `MatchingService`,
OpenRouter ni escrituras. Un documento `evaluation_results` ausente impide una comparación parcial
y devuelve un error controlado.

Los estados `strong`, `medium`, `weak`, `unknown` y `not_found` se preservan sin reinterpretarlos.
La respuesta añade indicadores de presentación: fortaleza para `strong`, información insuficiente
para `unknown` y gap obligatorio para estados no satisfactorios distintos de `unknown`. Los empates
se marcan explícitamente. El score continúa siendo heurístico: su orden descendente ayuda a navegar
los resultados, pero no constituye una recomendación de contratación.

## Topología de despliegue v0.1

```text
evidencefit.felipehenriquez.dev (Vercel / Next.js)
        │ API_URL server-side
        v
evidencefit-api.onrender.com (Render / NestJS persistente)
        ├── Neon PostgreSQL
        ├── MongoDB Atlas
        └── OpenRouter
```

Render se eligió por soportar un proceso Node persistente, healthcheck HTTP, monorepos y Blueprint
sin alterar el monolito. `render.yaml` ejecuta migraciones Prisma antes de iniciar y expone
`/api/health`. Vercel solo aloja Next.js y conserva `API_URL` como variable server-side. Esta
topología está preparada en el repositorio, pero se considera desplegada únicamente después de
configurar cuentas, secretos, DNS y ejecutar el smoke test real.
