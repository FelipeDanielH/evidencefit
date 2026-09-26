import { randomBytes, randomUUID } from 'node:crypto';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });
process.env.JWT_SECRET ||= randomBytes(48).toString('base64url');
const { configureMongoSrvDns } = await import('../dist/database/mongodb-dns.js');
configureMongoSrvDns(process.env.MONGODB_URI);

const expectedDatabase = process.env.MONGODB_DB_NAME?.trim() || 'evidencefit';
const runId = randomUUID();
const jobId = `atlas-smoke-job-${runId}`;
const candidateId = `atlas-smoke-candidate-${runId}`;
const evaluationId = `atlas-smoke-evaluation-${runId}`;
const collectionNames = [
  'job_requirement_extractions',
  'candidate_evidence_extractions',
  'evaluation_results',
];

const [
  { NestFactory },
  { getConnectionToken, getModelToken },
  { AppModule },
  { JobRequirementsStore },
  { CandidateEvidenceStore },
  { EvaluationResultStore },
  { JobRequirementsExtractionEntity },
  { CandidateEvidenceExtractionEntity },
  { EvaluationResultEntity },
] = await Promise.all([
  import('@nestjs/core'),
  import('@nestjs/mongoose'),
  import('../dist/app.module.js'),
  import('../dist/jobs/job-requirements.store.js'),
  import('../dist/candidates/candidate-evidence.store.js'),
  import('../dist/evaluations/evaluation-result.store.js'),
  import('../dist/jobs/schemas/job-requirements.schema.js'),
  import('../dist/candidates/schemas/candidate-evidence.schema.js'),
  import('../dist/evaluations/schemas/evaluation-result.schema.js'),
]);

const app = await NestFactory.createApplicationContext(AppModule, {
  abortOnError: false,
  logger: false,
});
const connection = app.get(getConnectionToken());
const jobStore = app.get(JobRequirementsStore);
const candidateStore = app.get(CandidateEvidenceStore);
const evaluationStore = app.get(EvaluationResultStore);
const models = [
  app.get(getModelToken(JobRequirementsExtractionEntity.name)),
  app.get(getModelToken(CandidateEvidenceExtractionEntity.name)),
  app.get(getModelToken(EvaluationResultEntity.name)),
];

const jobExtraction = {
  extractedAt: new Date().toISOString(),
  jobId,
  provider: 'atlas-smoke',
  requirements: [
    {
      category: 'technology',
      evidenceText: 'Experiencia con NestJS en una API REST',
      level: 'intermediate',
      name: 'NestJS',
      required: true,
      years: null,
    },
  ],
};
const candidateExtraction = {
  candidateId,
  evidence: [
    {
      category: 'technology',
      confidence: 0.8,
      evidenceLevel: 'medium',
      evidenceText: 'Desarrollé un proyecto sintético con NestJS',
      skill: 'NestJS',
      sourceType: 'project',
      years: null,
    },
  ],
  extractedAt: new Date().toISOString(),
  provider: 'atlas-smoke',
};
const evaluationResult = {
  candidateId,
  evaluatedAt: new Date().toISOString(),
  evaluationId,
  jobId,
  matches: [
    {
      confidence: 0.8,
      explanation: 'El proyecto sintético respalda el requisito.',
      matchedEvidence: [
        {
          category: 'technology',
          confidence: 0.8,
          evidenceLevel: 'medium',
          sourceType: 'project',
          text: 'Desarrollé un proyecto sintético con NestJS',
          years: null,
        },
      ],
      missingInformation: ['Años de experiencia no especificados'],
      requirement: {
        category: 'technology',
        level: 'intermediate',
        name: 'NestJS',
        required: true,
        years: null,
      },
      status: 'medium',
    },
  ],
  score: 0.8,
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  assert(connection.readyState === 1, 'Mongoose did not establish an Atlas connection.');
  assert(
    connection.name === expectedDatabase && connection.name === 'evidencefit',
    `Mongoose connected to unexpected database "${connection.name}".`,
  );

  await Promise.all(models.map((model) => model.init()));
  assert(
    models.every((model, index) => model.collection.collectionName === collectionNames[index]),
    'A Mongoose model is mapped to an unexpected collection.',
  );
  const logicalKeys = ['jobId', 'candidateId', 'evaluationId'];
  const indexes = await Promise.all(models.map((model) => model.collection.indexes()));
  assert(
    indexes.every((modelIndexes, index) =>
      modelIndexes.some(({ key, unique }) => unique === true && key[logicalKeys[index]] === 1),
    ),
    'A collection is missing its unique logical-reference index.',
  );
  await Promise.all([
    jobStore.upsert(jobExtraction),
    candidateStore.upsert(candidateExtraction),
    evaluationStore.upsert(evaluationResult),
  ]);
  await Promise.all([
    jobStore.upsert(jobExtraction),
    candidateStore.upsert(candidateExtraction),
    evaluationStore.upsert(evaluationResult),
  ]);

  const [storedJob, storedCandidate, storedEvaluation] = await Promise.all([
    jobStore.findByJobId(jobId),
    candidateStore.findByCandidateId(candidateId),
    evaluationStore.findByEvaluationId(evaluationId),
  ]);
  assert(storedJob?.requirements[0]?.name === 'NestJS', 'Job extraction was not recovered.');
  assert(
    storedCandidate?.evidence[0]?.evidenceText === candidateExtraction.evidence[0].evidenceText,
    'Candidate evidence was not recovered.',
  );
  assert(storedEvaluation?.matches[0]?.status === 'medium', 'Evaluation result was not recovered.');

  const database = connection.db;
  assert(database, 'MongoDB database handle is unavailable.');
  const collections = await database.listCollections().toArray();
  const availableNames = new Set(collections.map(({ name }) => name));
  assert(
    collectionNames.every((name) => availableNames.has(name)),
    'One or more expected Atlas collections are missing.',
  );

  const [jobDocument, candidateDocument, evaluationDocument] = await Promise.all([
    database.collection(collectionNames[0]).findOne({ jobId }),
    database.collection(collectionNames[1]).findOne({ candidateId }),
    database.collection(collectionNames[2]).findOne({ evaluationId }),
  ]);
  const forbiddenTopLevelFields = [
    'title',
    'description',
    'name',
    'cvText',
    'email',
    'passwordHash',
  ];
  for (const document of [jobDocument, candidateDocument, evaluationDocument]) {
    assert(document, 'A persisted smoke document could not be read directly.');
    assert(
      forbiddenTopLevelFields.every((field) => !Object.hasOwn(document, field)),
      'A MongoDB document duplicates relational entity data.',
    );
  }

  const counts = await Promise.all([
    database.collection(collectionNames[0]).countDocuments({ jobId }),
    database.collection(collectionNames[1]).countDocuments({ candidateId }),
    database.collection(collectionNames[2]).countDocuments({ evaluationId }),
  ]);
  assert(
    counts.every((count) => count === 1),
    'Upsert created duplicate documents.',
  );

  console.log(
    JSON.stringify({
      collections: collectionNames,
      database: connection.name,
      duplicationCheck: true,
      persistence: true,
      retrieval: true,
      schemasAndIndexes: true,
      tls: process.env.MONGODB_URI?.startsWith('mongodb+srv://') === true,
    }),
  );
} finally {
  const database = connection.db;
  if (database) {
    await Promise.all([
      database.collection(collectionNames[0]).deleteMany({ jobId }),
      database.collection(collectionNames[1]).deleteMany({ candidateId }),
      database.collection(collectionNames[2]).deleteMany({ evaluationId }),
    ]);
  }
  await app.close();
}
