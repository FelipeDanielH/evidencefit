import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import pg from 'pg';

config({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });
const { configureMongoSrvDns } = await import('../dist/database/mongodb-dns.js');
configureMongoSrvDns(process.env.MONGODB_URI);

const apiUrl = process.env.SMOKE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3102/api';
const postgresUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const mongoUri = process.env.MONGODB_URI;
const mongoDatabase = process.env.MONGODB_DB_NAME?.trim() || 'evidencefit';
if (!postgresUrl || !mongoUri) throw new Error('PostgreSQL and MongoDB must be configured.');

const runId = randomUUID();
const email = `openrouter-e2e-${runId}@example.invalid`;
const password = `EvidenceFit-${runId}-A1!`;
const jobIds = [];
const candidateIds = [];
const evaluationIds = [];
const postgres = new pg.Client({ connectionString: postgresUrl });
const mongo = mongoose.createConnection(mongoUri, {
  connectTimeoutMS: 5_000,
  dbName: mongoDatabase,
  serverSelectionTimeoutMS: 5_000,
});

async function request(path, options = {}, accessToken) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned HTTP ${response.status}.`);
  }
  return payload;
}

const jobInput = {
  description: `Requisitos de esta vacante sintética:
- NestJS nivel intermedio es obligatorio.
- Se requieren 2 años de experiencia con PostgreSQL.
- TypeScript es deseable.
- Conocimiento de GraphQL.`,
  title: 'Backend Developer — synthetic E2E',
};
const candidates = [
  {
    cvText: `CV sintético — no corresponde a una persona real.
Skills: Docker
Proyecto Inventario: Desarrollé una API REST utilizando NestJS y PostgreSQL.`,
    isSynthetic: true,
    name: 'Candidate Atlas',
  },
  {
    cvText: `CV sintético — no corresponde a una persona real.
Skills: NestJS, GraphQL
Proyecto Portal: Construí una interfaz utilizando TypeScript.`,
    isSynthetic: true,
    name: 'Candidate Boreal',
  },
];

await Promise.all([postgres.connect(), mongo.asPromise()]);

try {
  await request('/auth/register', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });
  const login = await request('/auth/login', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });
  if (typeof login.accessToken !== 'string') throw new Error('Login did not return a JWT.');
  const token = login.accessToken;

  const job = await request('/jobs', { body: JSON.stringify(jobInput), method: 'POST' }, token);
  jobIds.push(job.id);
  const requirements = await request(
    `/jobs/${job.id}/extract-requirements`,
    { method: 'POST' },
    token,
  );
  if (!Array.isArray(requirements.requirements) || requirements.requirements.length === 0) {
    throw new Error('The job extraction is empty.');
  }

  for (const input of candidates) {
    const candidate = await request(
      '/candidates',
      { body: JSON.stringify(input), method: 'POST' },
      token,
    );
    candidateIds.push(candidate.id);
    const evidence = await request(
      `/candidates/${candidate.id}/extract-evidence`,
      { method: 'POST' },
      token,
    );
    if (!Array.isArray(evidence.evidence) || evidence.evidence.length === 0) {
      throw new Error('A candidate evidence extraction is empty.');
    }

    const evaluation = await request(
      '/evaluations',
      {
        body: JSON.stringify({ candidateId: candidate.id, jobId: job.id }),
        method: 'POST',
      },
      token,
    );
    evaluationIds.push(evaluation.id);
    const recovered = await request(`/evaluations/${evaluation.id}`, {}, token);
    if (recovered.id !== evaluation.id || !Array.isArray(recovered.result?.matches)) {
      throw new Error('An evaluation could not be recovered with its document result.');
    }
  }

  const comparison = await request(
    `/jobs/${job.id}/comparison?evaluationIds=${encodeURIComponent(evaluationIds.join(','))}`,
    {},
    token,
  );
  if (!Array.isArray(comparison.candidates) || comparison.candidates.length !== 2) {
    throw new Error('Comparison did not include both evaluated candidates.');
  }

  const relationalCounts = [
    await postgres.query('SELECT COUNT(*)::int AS count FROM jobs WHERE id = $1', [job.id]),
    await postgres.query(
      'SELECT COUNT(*)::int AS count FROM candidates WHERE id = ANY($1::text[])',
      [candidateIds],
    ),
    await postgres.query(
      'SELECT COUNT(*)::int AS count FROM evaluations WHERE id = ANY($1::text[])',
      [evaluationIds],
    ),
  ];
  const database = mongo.db;
  if (!database) throw new Error('MongoDB database handle is unavailable.');
  const documentCounts = await Promise.all([
    database.collection('job_requirement_extractions').countDocuments({ jobId: job.id }),
    database
      .collection('candidate_evidence_extractions')
      .countDocuments({ candidateId: { $in: candidateIds } }),
    database
      .collection('evaluation_results')
      .countDocuments({ evaluationId: { $in: evaluationIds } }),
  ]);
  const expectedRelationalCounts = [1, 2, 2];
  if (
    relationalCounts.some(({ rows }, index) => rows[0]?.count !== expectedRelationalCounts[index])
  ) {
    throw new Error('The relational E2E entities were not persisted as expected.');
  }
  if (documentCounts.some((count, index) => count !== expectedRelationalCounts[index])) {
    throw new Error('The document E2E results were not persisted as expected.');
  }

  console.log(
    JSON.stringify({
      candidatesCompared: comparison.candidates.length,
      candidateEvidenceDocuments: documentCounts[1],
      evaluationResults: documentCounts[2],
      jobRequirementDocuments: documentCounts[0],
      model: process.env.OPENROUTER_MODEL,
      status: 'passed',
    }),
  );
} finally {
  const database = mongo.db;
  if (database) {
    await Promise.all([
      database.collection('job_requirement_extractions').deleteMany({ jobId: { $in: jobIds } }),
      database
        .collection('candidate_evidence_extractions')
        .deleteMany({ candidateId: { $in: candidateIds } }),
      database
        .collection('evaluation_results')
        .deleteMany({ evaluationId: { $in: evaluationIds } }),
    ]);
  }
  if (evaluationIds.length > 0) {
    await postgres.query('DELETE FROM evaluations WHERE id = ANY($1::text[])', [evaluationIds]);
  }
  if (jobIds.length > 0) {
    await postgres.query('DELETE FROM jobs WHERE id = ANY($1::text[])', [jobIds]);
  }
  if (candidateIds.length > 0) {
    await postgres.query('DELETE FROM candidates WHERE id = ANY($1::text[])', [candidateIds]);
  }
  await postgres.query('DELETE FROM users WHERE email = $1', [email]);
  await Promise.all([postgres.end(), mongo.close()]);
}
