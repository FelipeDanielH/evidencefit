import { config } from 'dotenv';

config({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });

const [{ ConfigService }, { OpenRouterProvider }] = await Promise.all([
  import('@nestjs/config'),
  import('../dist/ai/providers/openrouter.provider.js'),
]);

const provider = new OpenRouterProvider(new ConfigService(process.env));
if (!provider.isConfigured()) {
  throw new Error('OpenRouter is not configured with an allowed free model.');
}

const jobInput = {
  title: 'Backend Developer — synthetic smoke test',
  description: `Requisitos de esta vacante sintética:
- NestJS nivel intermedio es obligatorio.
- Se requieren 2 años de experiencia con PostgreSQL.
- TypeScript es deseable.
- Conocimiento de GraphQL.`,
};
const cvInput = `CV sintético — no corresponde a una persona real.
Skills: Docker
Proyecto Inventario: Desarrollé una API REST utilizando NestJS y PostgreSQL.
Educación: Ingeniería en Computación.`;

const requirementCategories = new Set([
  'technology',
  'skill',
  'experience',
  'education',
  'language',
  'other',
  'unknown',
]);
const requirementLevels = new Set(['beginner', 'intermediate', 'advanced', 'expert', 'unknown']);
const evidenceCategories = new Set(requirementCategories);
const evidenceLevels = new Set(['strong', 'medium', 'weak', 'unknown']);
const sourceTypes = new Set([
  'professional_experience',
  'project',
  'education',
  'skills_section',
  'other',
  'unknown',
]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const normalize = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

const requirements = await provider.extractJobRequirements(jobInput);
assert(requirements.requirements.length > 0, 'OpenRouter returned no job requirements.');
for (const requirement of requirements.requirements) {
  assert(requirementCategories.has(requirement.category), 'Invalid requirement category.');
  assert(requirementLevels.has(requirement.level), 'Invalid requirement level.');
  assert(
    normalize(jobInput.description).includes(normalize(requirement.evidenceText)),
    'A requirement is not grounded in the job description.',
  );
}
const graphql = requirements.requirements.find((item) =>
  item.name.toLowerCase().includes('graphql'),
);
assert(graphql?.level === 'unknown', 'Unstated GraphQL level was not preserved as unknown.');
assert(graphql.required === null, 'Unstated GraphQL required flag was not preserved as null.');
assert(graphql.years === null, 'Unstated GraphQL years were not preserved as null.');

const candidate = await provider.extractCandidateEvidence(cvInput);
assert(candidate.evidence.length > 0, 'OpenRouter returned no candidate evidence.');
for (const evidence of candidate.evidence) {
  assert(evidenceCategories.has(evidence.category), 'Invalid evidence category.');
  assert(evidenceLevels.has(evidence.evidenceLevel), 'Invalid evidence level.');
  assert(sourceTypes.has(evidence.sourceType), 'Invalid evidence source type.');
  assert(
    normalize(cvInput).includes(normalize(evidence.evidenceText)),
    'Candidate evidence is not grounded in the CV.',
  );
  assert(evidence.years === null, 'The model invented years absent from the CV.');
  assert(
    evidence.sourceType !== 'professional_experience',
    'The model converted project or skills evidence into professional experience.',
  );
}
const docker = candidate.evidence.find((item) => item.skill.toLowerCase().includes('docker'));
assert(docker?.sourceType === 'skills_section', 'Docker was not classified as a skills mention.');
assert(docker.evidenceLevel === 'weak', 'A skills-only mention was not classified as weak.');
const nestEvidence = candidate.evidence.find((item) => item.skill.toLowerCase() === 'nestjs');
assert(nestEvidence?.sourceType === 'project', 'NestJS project evidence lost its source context.');
assert(
  nestEvidence.evidenceLevel === 'medium',
  'Concrete project evidence was not classified as medium.',
);

console.log(
  JSON.stringify({
    candidateEvidence: candidate.evidence,
    configuredModel: process.env.OPENROUTER_MODEL,
    jobRequirements: requirements.requirements,
    status: 'passed',
  }),
);
