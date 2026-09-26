# AGENTS.md — EvidenceFit

## 1. Propósito

EvidenceFit es un proyecto Full Stack B2B orientado a evaluación explicable de candidatos.

El MVP debe permitir:

1. Crear una vacante.
2. Ingresar CVs como texto.
3. Extraer requisitos de la vacante mediante IA.
4. Extraer evidencia verificable desde cada CV.
5. Comparar requisitos contra evidencia.
6. Generar un score explicable.
7. Comparar candidatos.
8. Mostrar claramente qué información fue encontrada, cuál falta y con qué nivel de confianza se realizó cada evaluación.

El proyecto NO intenta replicar DEX ni ningún producto propietario de Datta. Es un prototipo independiente de investigación y aprendizaje sobre matching explicable entre vacantes y candidatos.

El objetivo técnico es demostrar un flujo end-to-end con Next.js, NestJS, PostgreSQL, MongoDB, GenAI, testing y despliegue, usando una arquitectura que pueda crecer sin introducir complejidad innecesaria.

---

## 2. Stack obligatorio

### Monorepo

- pnpm
- pnpm workspaces

### Frontend

- Next.js
- TypeScript
- App Router
- TypeScript strict mode

### Backend

- NestJS
- TypeScript
- API REST
- DTOs
- ValidationPipe
- arquitectura modular

### Datos relacionales

- PostgreSQL
- Neon
- Prisma ORM

### Datos documentales

- MongoDB Atlas
- Mongoose
- MongoDB Compass únicamente como cliente local de inspección

### Autenticación

- JWT
- login sencillo para el MVP
- passwords almacenadas con hash seguro
- autorización básica para endpoints privados

### IA

- OpenRouter
- usar únicamente modelos gratuitos en v0.1
- encapsular el proveedor detrás de una abstracción para permitir cambiar de proveedor posteriormente

### Calidad

- ESLint
- Prettier
- Jest
- variables de entorno
- Docker para desarrollo/backend cuando aporte valor
- README
- documentación de decisiones arquitectónicas relevantes

---

## 3. Principios de arquitectura

### 3.1 Monolito modular primero

No usar microservicios en v0.1.

EvidenceFit debe comenzar como un monolito modular porque:

- el dominio todavía es pequeño;
- facilita el desarrollo y debugging;
- reduce costos operacionales;
- evita complejidad distribuida prematura;
- permite mantener límites claros entre dominios;
- cada módulo podrá extraerse posteriormente si aparece una necesidad real.

Nunca introducir microservicios solamente para "hacer la arquitectura más escalable".

### 3.2 SOLID con propósito

Aplicar SOLID cuando reduzca acoplamiento o mejore testabilidad.

No crear interfaces, capas o abstracciones sin un motivo concreto.

Prioridades:

- Single Responsibility: módulos, servicios y clases deben tener responsabilidades claras.
- Open/Closed: especialmente útil para proveedores de IA y estrategias de scoring.
- Liskov Substitution: no romper contratos de interfaces.
- Interface Segregation: interfaces pequeñas y específicas.
- Dependency Inversion: módulos de dominio deben depender de abstracciones cuando exista una dependencia externa relevante.

Ejemplo esperado:

```text
EvaluationService
        |
        v
   AiProvider
        |
        v
OpenRouterProvider
```

`EvaluationService` no debe depender directamente del SDK o detalles HTTP de OpenRouter.

### 3.3 Arquitectura explicable

La arquitectura debe ser defendible por un desarrollador junior.

Codex no debe introducir patrones complejos si una solución simple, modular y testeable resuelve el mismo problema.

Evitar salvo justificación real:

- CQRS
- Event Sourcing
- Kafka
- Kubernetes
- Redis
- microservicios
- hexagonalidad extrema
- DDD ceremonial
- múltiples capas de repositories/interfaces sin necesidad

Si Codex propone alguna de estas tecnologías, debe documentar primero qué problema concreto resuelve.

---

## 4. Estructura inicial del monorepo

Estructura sugerida:

```text
evidencefit/
├── apps/
│   ├── web/                 # Next.js
│   └── api/                 # NestJS
├── packages/
│   ├── contracts/           # tipos y contratos compartidos si realmente aportan valor
│   └── config/              # configuración compartida opcional
├── docs/
│   ├── architecture.md
│   └── decisions/
├── docker/
├── .github/
│   └── workflows/
├── AGENTS.md
├── ROADMAP.md
├── README.md
└── pnpm-workspace.yaml
```

No crear paquetes vacíos por adelantado.

Crear `packages/*` únicamente cuando exista código compartido real.

---

## 5. Dominios iniciales

Los módulos principales de v0.1 son:

```text
auth
jobs
candidates
evaluations
ai
```

### auth

Responsable de:

- registro/login mínimo;
- emisión y validación de JWT;
- password hashing;
- protección de endpoints.

### jobs

Responsable de:

- crear vacantes;
- almacenar título y descripción;
- obtener requisitos estructurados extraídos por IA.

### candidates

Responsable de:

- crear candidatos sintéticos;
- almacenar CV en formato texto;
- consultar candidatos;
- relacionarlos con evaluaciones.

### evaluations

Responsable de:

- ejecutar evaluación candidato-vacante;
- comparar requisito contra evidencia;
- producir score;
- producir explicación;
- almacenar resultados;
- permitir comparación básica entre candidatos.

### ai

Responsable de:

- integración con OpenRouter;
- prompts;
- structured outputs;
- manejo de errores;
- timeouts;
- retries limitados;
- validación de respuesta;
- desacoplamiento del proveedor.

---

## 6. Persistencia

### PostgreSQL / Neon

Usar PostgreSQL para información estructurada y relacional.

Ejemplos:

- users
- jobs
- candidates
- evaluations
- evaluation_requirements
- recruiter_feedback en versiones posteriores

Prisma es el ORM obligatorio para esta capa.

Las relaciones deben tener restricciones y claves coherentes.

Usar migraciones.

Nunca modificar producción mediante cambios manuales de esquema.

### MongoDB Atlas

MongoDB debe utilizarse donde aporte valor documental.

En v0.1 puede almacenar:

- documentos normalizados derivados de CV;
- requisitos extraídos por IA;
- evidencia extraída;
- outputs estructurados completos del modelo;
- metadata técnica de la ejecución.

No duplicar arbitrariamente todos los datos de PostgreSQL en MongoDB.

Cada almacenamiento debe tener una responsabilidad clara.

---

## 7. Integración de IA

### 7.1 OpenRouter

El MVP usará OpenRouter con modelos gratuitos.

Requisitos:

- API key mediante variable de entorno;
- modelo configurable;
- no hardcodear secretos;
- timeout explícito;
- errores controlados;
- response schema validado;
- proveedor desacoplado.

Interfaz conceptual:

```ts
interface AiProvider {
  extractJobRequirements(input: string): Promise<JobRequirement[]>;
  extractCandidateEvidence(input: string): Promise<CandidateEvidence[]>;
}
```

La implementación inicial será `OpenRouterProvider`.

Debe ser posible añadir en el futuro:

- GeminiProvider
- OpenAIProvider
- AnthropicProvider
- LocalProvider

sin reescribir el dominio de evaluaciones.

### 7.2 Structured output

Toda salida de IA relevante debe convertirse a una estructura tipada y validada.

Nunca confiar ciegamente en texto libre.

Ejemplo conceptual:

```json
{
  "skill": "NestJS",
  "evidenceLevel": "medium",
  "confidence": 0.72,
  "evidence": [
    {
      "source": "project",
      "text": "API REST desarrollada con NestJS"
    }
  ]
}
```

### 7.3 Comportamiento ante incertidumbre

EvidenceFit debe distinguir:

- evidencia encontrada;
- ausencia de evidencia;
- información desconocida;
- contradicción;
- fallo del modelo.

Nunca convertir automáticamente falta de información en una conclusión negativa.

Nunca inventar experiencia.

Cuando una afirmación no pueda justificarse con el CV, marcarla como `unknown` o equivalente.

---

## 8. Scoring

El scoring de v0.1 debe ser sencillo y explicable.

No crear un modelo matemático complejo.

Cada requisito puede evaluarse con un estado como:

```text
strong
medium
weak
unknown
not_found
```

El score total puede derivarse de ponderaciones simples.

Toda puntuación debe poder responder:

1. ¿Qué requisito se evaluó?
2. ¿Qué evidencia se encontró?
3. ¿Por qué recibió ese nivel?
4. ¿Con qué confianza?
5. ¿Qué información falta?

Nunca mostrar únicamente un porcentaje sin explicación.

---

## 9. Requisitos funcionales v0.1

### Autenticación

- crear usuario;
- iniciar sesión;
- recibir JWT;
- acceder a rutas privadas.

### Vacantes

- crear una vacante;
- ingresar título;
- pegar descripción;
- guardar;
- solicitar extracción de requisitos mediante IA;
- visualizar requisitos extraídos.

### Candidatos

- crear candidato;
- usar únicamente candidatos/CVs sintéticos para demo pública;
- pegar CV como texto;
- almacenar CV;
- consultar candidatos.

### Evaluación

- seleccionar una vacante;
- seleccionar un candidato;
- iniciar evaluación;
- extraer evidencia del CV;
- cruzar requisitos con evidencia;
- generar score explicable;
- mostrar:
  - requisito;
  - evidencia;
  - nivel;
  - confianza;
  - información faltante.

### Comparación

- evaluar al menos 2 candidatos para la misma vacante;
- mostrar comparación simple;
- ordenar por score;
- permitir inspeccionar evidencia detrás de cada resultado.

---

## 10. Requisitos NO funcionales

### Seguridad

- passwords hasheadas;
- JWT con expiración;
- secrets solo mediante env;
- validación de inputs;
- sanitización razonable;
- rate limiting si resulta sencillo;
- evitar filtrado accidental de prompts/secrets;
- no almacenar CVs reales en el repositorio;
- no usar datos personales reales en fixtures públicos.

### Rendimiento

No optimizar prematuramente.

Sí:

- evitar consultas N+1 obvias;
- agregar índices donde sean necesarios;
- medir llamadas costosas de IA;
- limitar tamaño de inputs;
- manejar timeouts.

### Observabilidad

Como mínimo:

- logs estructurados razonables;
- errores identificables;
- tiempos de llamadas IA cuando sea sencillo;
- no registrar secretos ni CVs completos innecesariamente.

---

## 11. Testing

v0.1 debe tener tests suficientes para demostrar criterio, no cobertura artificial.

Prioridad:

### Unit tests

- scoring;
- normalización;
- servicios críticos;
- comportamiento ante `unknown`;
- validación de outputs de IA.

### Integration tests

- endpoints principales de jobs;
- candidates;
- evaluations.

### Casos importantes

Agregar gradualmente casos como:

```text
skill_mentioned_without_evidence
skill_with_project_evidence
missing_information_returns_unknown
same_candidate_different_wording
irrelevant_keyword_stuffing
contradictory_employment_dates
```

No mockear toda la aplicación.

Las dependencias externas de IA sí pueden mockearse para tests determinísticos.

---

## 12. Frontend

El frontend debe ser funcional, limpio y simple.

No dedicar la mayor parte del tiempo a animaciones o diseño visual.

Pantallas mínimas:

1. Login
2. Dashboard
3. Crear vacante
4. Detalle de vacante
5. Agregar candidato
6. Detalle candidato
7. Resultado evaluación
8. Comparación candidatos

La interfaz debe poner el foco en:

- evidencia;
- explicación;
- confianza;
- comparación.

No usar componentes visuales innecesarios.

---

## 13. Backend

Normas:

- controllers delgados;
- lógica en services;
- DTOs para inputs;
- ValidationPipe global;
- exceptions de NestJS adecuadas;
- módulos con límites claros;
- no acceder directamente a DB desde controllers;
- no hacer llamadas OpenRouter desde controllers.

Evitar archivos gigantes.

Evitar servicios "god object".

---

## 14. TypeScript

- `strict: true`
- evitar `any`
- no usar `as` para ocultar errores de tipos salvo justificación;
- tipos explícitos en límites importantes;
- validar datos externos en runtime;
- no asumir que una respuesta externa es segura por estar tipada en compile time.

---

## 15. Git y commits

Codex debe producir cambios pequeños y coherentes.

Idealmente cada fase deja el proyecto ejecutable.

Ejemplos:

```text
feat(api): add jobs module
feat(ai): add OpenRouter provider
feat(web): add job creation flow
test(scoring): cover unknown evidence
docs: explain database split
```

No acumular cientos de cambios sin validar.

---

## 16. CI

Agregar GitHub Actions cuando el MVP básico funcione.

Pipeline mínimo:

- install
- lint
- typecheck
- tests
- build

No desplegar si estas validaciones fallan.

---

## 17. Deployment

Objetivo público:

```text
https://evidencefit.felipehenriquez.dev
```

Stack esperado:

- frontend: Vercel
- backend: servicio compatible con NestJS persistente
- PostgreSQL: Neon
- MongoDB: MongoDB Atlas

No asumir que Datta usa estos proveedores.

Son decisiones del demo.

El backend puede desplegarse inicialmente en un proveedor sencillo y cambiarse posteriormente.

---

## 18. README obligatorio

El README debe explicar:

1. qué problema intenta estudiar EvidenceFit;
2. qué NO intenta ser;
3. arquitectura;
4. stack;
5. por qué PostgreSQL y MongoDB cumplen funciones diferentes;
6. por qué se eligió monolito modular;
7. cómo se usa OpenRouter;
8. cómo ejecutar localmente;
9. variables de entorno;
10. cómo correr tests;
11. limitaciones actuales;
12. roadmap.

No afirmar accuracy, precisión o calidad que no haya sido medida.

---

## 19. Definition of Done v0.1

v0.1 estará terminada cuando:

- monorepo pnpm funciona;
- frontend Next.js funciona;
- backend NestJS funciona;
- PostgreSQL/Neon conectado;
- MongoDB Atlas conectado;
- autenticación JWT funciona;
- puede crearse una vacante;
- puede pegarse un CV sintético;
- OpenRouter extrae requisitos;
- OpenRouter extrae evidencia;
- se genera una evaluación explicable;
- pueden compararse al menos dos candidatos;
- tests principales pasan;
- lint y typecheck pasan;
- aplicación está desplegada;
- README explica arquitectura;
- no existen secrets en git;
- el flujo principal puede demostrarse en pocos minutos.

---

## 20. Qué NO hacer

Codex no debe:

- construir un ATS completo;
- replicar DEX;
- usar CVs reales;
- añadir features fuera del roadmap sin necesidad;
- crear microservicios;
- introducir infraestructura enterprise ficticia;
- inventar métricas;
- crear abstracciones sin uso real;
- usar tecnologías únicamente para engordar el stack;
- generar código que el responsable del proyecto no pueda explicar;
- ocultar errores con `any`;
- dejar secretos hardcodeados;
- sacrificar claridad por sofisticación.

---

## 21. Regla principal para Codex

Prioriza:

```text
simple
→ funcional
→ probado
→ explicable
→ desplegado
→ extensible
```

antes que:

```text
complejo
→ sofisticado
→ "enterprise"
→ difícil de defender
```

EvidenceFit debe crecer por necesidades reales del producto, no por arquitectura anticipada.
