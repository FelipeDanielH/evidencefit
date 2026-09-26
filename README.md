# EvidenceFit

EvidenceFit es un prototipo Full Stack B2B para estudiar la evaluación explicable de candidatos.
Busca relacionar requisitos de una vacante con evidencia verificable de un CV, mostrando también
incertidumbre, información ausente y confianza. No intenta replicar DEX, un ATS completo ni ningún
producto propietario.

## Estado actual: v0.1 release candidate

El primer flujo funcional de la v0.1 permite:

- monorepo pnpm;
- frontend Next.js 16, TypeScript y App Router;
- API NestJS modular;
- TypeScript strict, ESLint, Prettier y Jest;
- crear, listar y consultar vacantes persistidas con Prisma en PostgreSQL/Neon;
- extraer requisitos estructurados mediante un modelo gratuito de OpenRouter;
- validar y guardar la extracción documental con Mongoose en MongoDB Atlas;
- visualizar la descripción original y los requisitos desde el frontend;
- crear, listar y consultar candidatos con CVs sintéticos persistidos en PostgreSQL;
- extraer, validar, persistir y visualizar evidencia documental de esos CVs;
- evaluar un candidato contra una vacante mediante matching determinista por requisito;
- persistir y visualizar estados, evidencia, faltantes, explicaciones y score heurístico;
- seleccionar dos o más evaluaciones de una vacante y compararlas lado a lado sin recalcularlas;
- registrar usuarios, iniciar sesión y persistir cuentas con Prisma;
- almacenar passwords con bcrypt y emitir JWT con expiración;
- proteger jobs, candidates, evaluations y comparison mediante un guard JWT global;
- conservar la sesión web en una cookie `httpOnly` mediante un BFF mínimo de Next.js;
- abstracción `AiProvider` con implementación `OpenRouterProvider`;
- pruebas de endpoints y validación de outputs sin servicios externos reales.

El código funcional de v0.1 está completo. La release todavía no se declara terminada porque faltan
las conexiones y verificaciones con cuentas reales de Neon, Atlas, OpenRouter, Render, Vercel y DNS.
Consulta [docs/release-checklist-v0.1.md](docs/release-checklist-v0.1.md).

## Estructura

```text
EvidenceFit/
├── apps/
│   ├── web/                 # Next.js App Router
│   └── api/                 # NestJS monolito modular
│       ├── prisma/          # schema relacional
│       ├── src/
│       │   ├── auth/
│       │   ├── jobs/
│       │   ├── candidates/
│       │   ├── evaluations/
│       │   ├── ai/
│       │   └── database/
│       └── test/
├── docs/
│   └── architecture.md
├── fixtures/                # Vacante y CVs completamente sintéticos
├── scripts/                 # Smoke test end-to-end contra producción
├── render.yaml              # Blueprint del backend persistente
├── AGENTS.md
├── ROADMAP.md
├── pnpm-workspace.yaml
└── package.json
```

No hay un directorio `packages/` porque aún no existe código compartido que justifique un paquete.

## Arquitectura

La v0.1 usa un monolito modular: mantiene bajo el costo operativo y hace visibles los límites de
dominio sin introducir comunicación distribuida. Consulta [docs/architecture.md](docs/architecture.md)
para el diagrama y las decisiones iniciales.

`Job` vive en PostgreSQL porque es una entidad estable, consultable y relacional. MongoDB almacena
`job_requirement_extractions`, un documento derivado y reemplazable que conserva la lista completa
de requisitos. El campo Mongo `jobId` es único y apunta al identificador de PostgreSQL; la aplicación
mantiene esta asociación porque no puede existir una FK entre motores.

La misma separación se aplica a candidatos: `Candidate` y su `cvText` original viven en PostgreSQL,
mientras `candidate_evidence_extractions` guarda el documento derivado en MongoDB. `candidateId` es
una referencia lógica única. Una lista de habilidades no prueba experiencia: las menciones de
`skills_section` se validan como evidencia `weak`, sin años, y no pueden convertirse en experiencia
profesional.

OpenRouter está detrás de `AiProvider`. `JobsService` conoce ese contrato, no la clase
`OpenRouterProvider`. La extracción usa JSON Schema estricto, temperatura `0`, enums cerrados y una
validación local que exige que cada `evidenceText` aparezca en la descripción original. Nivel y años
se representan como `unknown`/`null` cuando no están declarados, evitando completar huecos.
Para candidatos, cada `evidenceText` también debe encontrarse en el CV original; un output inválido
o no respaldado devuelve `502` y no llega a MongoDB.

El matching no se delega a OpenRouter. `MatchingService` normaliza únicamente diferencias de
escritura seguras —mayúsculas, acentos, espacios y puntuación— y exige igualdad del nombre
normalizado. No supone equivalencias como JavaScript/TypeScript, Node.js/NestJS o React/Next.js.
PostgreSQL conserva `Evaluation`, sus relaciones y el score; MongoDB conserva
`evaluation_results`, el detalle derivado y explicable por requisito.

La comparación no se persiste como entidad. Se construye bajo demanda con las `Evaluation`
existentes de una misma vacante y sus `evaluation_results`; no recalcula matching, no llama a
OpenRouter y no crea evaluaciones. Puede ordenar por score descendente, manteniendo estable el orden
solicitado en empates. Ese orden sigue siendo una lectura de la heurística de EvidenceFit y no una
recomendación de contratación.

La API usa un guard JWT global. Únicamente registro, login y healthcheck son públicos. En la web,
Next.js recibe el JWT del backend y lo guarda en una cookie `httpOnly`, `SameSite=Lax` y `Secure` en
producción. El navegador llama a un proxy same-origin y nunca necesita leer el token ni conocer los
secretos del backend.

## Demo pública

URL objetivo: [https://evidencefit.felipehenriquez.dev](https://evidencefit.felipehenriquez.dev).

La URL no debe considerarse disponible hasta completar el checklist de release. El backend se
prepara para Render como Web Service Node persistente y el frontend para Vercel. Neon conserva los
datos relacionales, Atlas los documentos derivados y OpenRouter realiza únicamente las dos
extracciones estructuradas.

## API de autenticación

| Método | Ruta                 | Descripción                                         |
| ------ | -------------------- | --------------------------------------------------- |
| `POST` | `/api/auth/register` | Crea el usuario, hashea el password y devuelve JWT. |
| `POST` | `/api/auth/login`    | Valida credenciales y devuelve JWT.                 |

Enviar el JWT como `Authorization: Bearer <token>` para cualquier otro endpoint, excepto
`GET /api/health`.

## API de vacantes

| Método | Ruta                                 | Descripción                                 |
| ------ | ------------------------------------ | ------------------------------------------- |
| `POST` | `/api/jobs`                          | Crea una vacante.                           |
| `GET`  | `/api/jobs`                          | Lista vacantes, más recientes primero.      |
| `GET`  | `/api/jobs/:id`                      | Obtiene una vacante y su extracción actual. |
| `POST` | `/api/jobs/:id/extract-requirements` | Extrae, valida y guarda requisitos.         |

## API de candidatos

| Método | Ruta                                   | Descripción                                          |
| ------ | -------------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/candidates`                      | Crea un candidato; exige confirmar un CV sintético.  |
| `GET`  | `/api/candidates`                      | Lista candidatos, más recientes primero.             |
| `GET`  | `/api/candidates/:id`                  | Obtiene candidato y extracción vigente.              |
| `POST` | `/api/candidates/:id/extract-evidence` | Extrae, valida y guarda evidencia respaldada por CV. |

## API de evaluaciones

| Método | Ruta                   | Descripción                                                  |
| ------ | ---------------------- | ------------------------------------------------------------ |
| `POST` | `/api/evaluations`     | Evalúa un `jobId` y `candidateId` con extracciones vigentes. |
| `GET`  | `/api/evaluations/:id` | Obtiene la evaluación y su detalle explicable.               |

## API de comparación

| Método | Ruta                                                | Descripción                                              |
| ------ | --------------------------------------------------- | -------------------------------------------------------- |
| `GET`  | `/api/jobs/:jobId/evaluations`                      | Lista evaluaciones disponibles para esa vacante.         |
| `GET`  | `/api/jobs/:jobId/comparison?evaluationIds=id1,id2` | Agrega dos o más resultados existentes para compararlos. |

Estados del matching:

- `strong`: evidencia directa suficiente;
- `medium`: evidencia práctica relevante con alguna condición sin acreditar;
- `weak`: mención o evidencia limitada;
- `unknown`: existe información relacionada, pero no permite concluir;
- `not_found`: no existe evidencia con el mismo nombre normalizado.

El score usa `strong=1`, `medium=0.7`, `weak=0.4`, `unknown=0.2` y
`not_found=0`. Los requisitos obligatorios pesan `2`; deseables o no indicados pesan `1`. El
resultado es la media ponderada en escala `0..1`: es una heurística interna, no una probabilidad de
contratación ni una medición estadística.

## Requisitos

- Node.js 22 o superior;
- pnpm 10 o superior (el repositorio fija pnpm 11.3.0);
- credenciales propias de Neon, MongoDB Atlas y OpenRouter cuando se prueben esas integraciones.

## Instalación

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
```

Copia `.env.example` como `.env` en la raíz. Para cambiar la URL usada por el navegador, copia
`apps/web/.env.local.example` como `apps/web/.env.local`. `API_URL` es server-side: ninguna API key,
URI de base de datos o JWT secret usa el prefijo `NEXT_PUBLIC_`. Completa únicamente los valores que
utilizarás y no guardes archivos `.env` en Git.

## Variables de entorno

| Variable                 | Requerida para     | Descripción                                                          |
| ------------------------ | ------------------ | -------------------------------------------------------------------- |
| `API_PORT`               | API                | Puerto; por defecto `3001`.                                          |
| `PORT`                   | Hosting backend    | Puerto inyectado por Render; tiene precedencia si no hay `API_PORT`. |
| `WEB_ORIGIN`             | API                | Origen CORS del frontend; por defecto `http://localhost:3000`.       |
| `API_URL`                | Next.js server     | Base REST privada; localmente `http://localhost:3001/api`.           |
| `DATABASE_URL`           | Runtime PostgreSQL | URL pooled de Neon usada por NestJS.                                 |
| `DATABASE_URL_UNPOOLED`  | Migraciones Prisma | URL directa de Neon usada por Prisma CLI.                            |
| `MONGODB_URI`            | Acceso MongoDB     | URI de MongoDB Atlas.                                                |
| `MONGODB_DB_NAME`        | Acceso MongoDB     | Base documental; por defecto `evidencefit`.                          |
| `JWT_SECRET`             | Arranque del API   | Secreto largo generado por el desarrollador.                         |
| `JWT_EXPIRES_IN_SECONDS` | JWT                | Duración del token; por defecto `3600`.                              |
| `OPENROUTER_API_KEY`     | Llamadas de IA     | API key propia de OpenRouter.                                        |
| `OPENROUTER_MODEL`       | Llamadas de IA     | `openrouter/free` o un modelo específico terminado en `:free`.       |
| `OPENROUTER_TIMEOUT_MS`  | Llamadas de IA     | Timeout; por defecto `60000` para tolerar el router gratuito.        |
| `SMOKE_API_URL`          | Smoke manual       | Base pública del API desplegado, terminada en `/api`.                |
| `SMOKE_EMAIL`            | Smoke manual       | Email sintético para el smoke test.                                  |
| `SMOKE_PASSWORD`         | Smoke manual       | Password no reutilizado para el smoke test.                          |

En Neon, `DATABASE_URL` debe apuntar al hostname pooled (`-pooler`) y
`DATABASE_URL_UNPOOLED` a la conexión directa. Prisma usa la segunda para migraciones y NestJS usa la
primera durante la ejecución. Ambas requieren SSL según las URLs entregadas por Neon.

MongoDB Atlas usa la base indicada por `MONGODB_DB_NAME`, incluso si `MONGODB_URI` no incluye una
ruta de base de datos. Las tres colecciones documentales son `job_requirement_extractions`,
`candidate_evidence_extractions` y `evaluation_results`.

El API puede iniciar sin conexiones a PostgreSQL, MongoDB u OpenRouter para servir health checks.
Las rutas de vacantes, candidatos y evaluaciones requieren `DATABASE_URL`; las extracciones y el
detalle de evaluación requieren además `MONGODB_URI`,
`OPENROUTER_API_KEY` y `OPENROUTER_MODEL=openrouter/free` —o un modelo gratuito específico terminado
en `:free`— compatible con structured outputs. `JWT_SECRET` sigue siendo obligatoria porque no se
incluye un secreto inseguro por defecto.

Para v0.1 se validó `dots-studio/dots-3-note-preview:free` con `json_schema` estricto. El router
`openrouter/free` también acepta el request, pero puede seleccionar modelos con comportamiento
semántico desigual. La disponibilidad de modelos gratuitos depende de OpenRouter.

## Datos demo sintéticos

[fixtures/demo-v0.1.json](fixtures/demo-v0.1.json) contiene una vacante Full Stack y tres perfiles
ficticios: buen match, match parcial e información insuficiente. Los textos están diseñados para
ejercitar `strong`, `medium`, `weak`, `unknown` y `not_found`, pero el resultado exacto de extracción
debe comprobarse con el modelo gratuito configurado. No contiene nombres, CVs ni experiencia de
personas reales.

Flujo manual:

1. Crear una cuenta o iniciar sesión.
2. Crear la vacante del fixture y extraer requisitos.
3. Crear cada candidato confirmando que el CV es sintético y extraer evidencia.
4. Evaluar al menos dos candidatos.
5. Abrir la vacante, seleccionar “Comparar candidatos evaluados” e inspeccionar la evidencia.

El score es una heurística interna; no es una probabilidad ni una recomendación de contratación.

## Desarrollo

Iniciar web y API juntos:

```bash
pnpm dev
```

O iniciarlos por separado:

```bash
pnpm --filter @evidencefit/web dev
pnpm --filter @evidencefit/api dev
```

- Web: `http://localhost:3000`
- Health del API: `http://localhost:3001/api/health`

## Calidad

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Smoke test real, después del deployment:

```bash
pnpm smoke:production
```

El comando exige `SMOKE_API_URL`, `SMOKE_EMAIL` y `SMOKE_PASSWORD`, crea datos sintéticos y verifica
health, auth, PostgreSQL, MongoDB, OpenRouter, evaluación y comparación.

## Tests

Los tests reemplazan Prisma, los stores Mongo y `AiProvider` por dobles determinísticos. Cubren
creación, consulta, extracción exitosa, persistencia, output inválido, campos desconocidos, skill
solo mencionada, evidencia de proyecto, años ausentes, cita inventada y fallo del proveedor. No
consumen OpenRouter ni bases reales. El matching agrega cobertura para normalización, match exacto,
`unknown`, `not_found`, años no verificables, pesos, scoring, precondiciones y compensación ante
fallos de persistencia documental.
La comparación agrega casos para dos y tres candidatos, mínimo inválido, evaluación de otra
vacante, empates, orden estable, `strong` frente a `not_found`, `unknown`, gaps obligatorios y
detalle documental ausente.

## Deployment preparado

- Backend: importar `render.yaml` en Render, configurar sus secretos y usar `/api/health` como probe.
- Frontend: proyecto Vercel con Root Directory `apps/web`; configurar `API_URL` con la URL pública de
  Render y `JWT_EXPIRES_IN_SECONDS` con el mismo valor que el backend.
- Producción: configurar `WEB_ORIGIN=https://evidencefit.felipehenriquez.dev`, dominio Vercel, DNS,
  migraciones y smoke test.

No están incluidos en v0.1: RBAC, carga de PDF, feedback recruiter, embeddings, queues, nuevos
proveedores, ranking avanzado, pesos configurables ni métricas de calidad del modelo.

El alcance completo y el orden de versiones están en [ROADMAP.md](ROADMAP.md).
