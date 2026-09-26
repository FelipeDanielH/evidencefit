import { ServiceUnavailableException, ValidationPipe, type INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Candidate, Evaluation, Job, Prisma } from '../src/generated/prisma/client.js';
import {
  CandidateEvidenceStore,
  type StoredCandidateEvidence,
} from '../src/candidates/candidate-evidence.store.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  EvaluationResultStore,
  type StoredEvaluationResult,
} from '../src/evaluations/evaluation-result.store.js';
import { EvaluationsController } from '../src/evaluations/evaluations.controller.js';
import { EvaluationsService } from '../src/evaluations/evaluations.service.js';
import { MatchingService } from '../src/evaluations/matching.service.js';
import {
  JobRequirementsStore,
  type StoredJobRequirements,
} from '../src/jobs/job-requirements.store.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a JSON response object.');
  return value;
}

describe('Evaluations API', () => {
  let app: INestApplication;
  let apiUrl: string;
  const job: Job = {
    id: 'job-1',
    title: 'Backend Engineer',
    description: 'NestJS con 2 años de experiencia.',
    createdAt: new Date('2026-09-25T12:00:00.000Z'),
    updatedAt: new Date('2026-09-25T12:00:00.000Z'),
  };
  const candidate: Candidate = {
    id: 'candidate-1',
    name: 'Alex Sintético',
    cvText: 'Proyecto: Desarrollé servicios con NestJS.',
    createdAt: new Date('2026-09-25T12:00:00.000Z'),
    updatedAt: new Date('2026-09-25T12:00:00.000Z'),
  };
  let requirements: StoredJobRequirements | null;
  let evidence: StoredCandidateEvidence | null;
  const results = new Map<string, StoredEvaluationResult>();

  const findJob = jest.fn(({ where }: Prisma.JobFindUniqueArgs): Promise<Job | null> =>
    Promise.resolve(where.id === job.id ? job : null),
  );
  const findCandidate = jest.fn(
    ({ where }: Prisma.CandidateFindUniqueArgs): Promise<Candidate | null> =>
      Promise.resolve(where.id === candidate.id ? candidate : null),
  );
  const createEvaluation = jest.fn(({ data }: Prisma.EvaluationCreateArgs): Promise<Evaluation> => {
    if (typeof data.jobId !== 'string' || typeof data.candidateId !== 'string') {
      throw new Error('Expected direct evaluation foreign keys.');
    }
    const now = new Date('2026-09-25T13:00:00.000Z');
    return Promise.resolve({
      id: 'evaluation-1',
      jobId: data.jobId,
      candidateId: data.candidateId,
      score: data.score ?? null,
      createdAt: now,
      updatedAt: now,
    });
  });
  const findEvaluation = jest.fn(
    ({ where }: Prisma.EvaluationFindUniqueArgs): Promise<Evaluation | null> => {
      if (where.id !== 'evaluation-1') return Promise.resolve(null);
      const result = results.get('evaluation-1');
      const now = new Date('2026-09-25T13:00:00.000Z');
      return Promise.resolve(
        result
          ? {
              id: 'evaluation-1',
              jobId: job.id,
              candidateId: candidate.id,
              score: result.score,
              createdAt: now,
              updatedAt: now,
            }
          : null,
      );
    },
  );
  const deleteEvaluation = jest.fn((): Promise<Evaluation> => {
    const now = new Date('2026-09-25T13:00:00.000Z');
    return Promise.resolve({
      id: 'evaluation-1',
      jobId: job.id,
      candidateId: candidate.id,
      score: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  const prismaMock = {
    client: {
      candidate: { findUnique: findCandidate },
      evaluation: {
        create: createEvaluation,
        delete: deleteEvaluation,
        findUnique: findEvaluation,
      },
      job: { findUnique: findJob },
    },
  };

  const requirementsStoreMock = {
    findByJobId: jest.fn((): Promise<StoredJobRequirements | null> =>
      Promise.resolve(requirements),
    ),
  };
  const evidenceStoreMock = {
    findByCandidateId: jest.fn((): Promise<StoredCandidateEvidence | null> =>
      Promise.resolve(evidence),
    ),
  };
  const evaluationResultStoreMock = {
    findByEvaluationId: jest.fn((id: string): Promise<StoredEvaluationResult | null> =>
      Promise.resolve(results.get(id) ?? null),
    ),
    upsert: jest.fn((result: StoredEvaluationResult): Promise<StoredEvaluationResult> => {
      results.set(result.evaluationId, result);
      return Promise.resolve(result);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EvaluationsController],
      providers: [
        EvaluationsService,
        MatchingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JobRequirementsStore, useValue: requirementsStoreMock },
        { provide: CandidateEvidenceStore, useValue: evidenceStoreMock },
        { provide: EvaluationResultStore, useValue: evaluationResultStoreMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    apiUrl = await app.getUrl();
  });

  beforeEach(() => {
    requirements = {
      extractedAt: '2026-09-25T12:00:00.000Z',
      jobId: job.id,
      provider: 'mock-provider',
      requirements: [
        {
          category: 'technology',
          evidenceText: 'NestJS con 2 años de experiencia',
          level: 'unknown',
          name: 'NestJS',
          required: true,
          years: 2,
        },
      ],
    };
    evidence = {
      candidateId: candidate.id,
      extractedAt: '2026-09-25T12:30:00.000Z',
      provider: 'mock-provider',
      evidence: [
        {
          category: 'technology',
          confidence: 0.8,
          evidenceLevel: 'medium',
          evidenceText: 'Desarrollé servicios con NestJS',
          skill: 'NestJS',
          sourceType: 'project',
          years: null,
        },
      ],
    };
    results.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a job without a requirements extraction', async () => {
    requirements = null;
    const response = await request(apiUrl).post('/api/evaluations').send({
      jobId: job.id,
      candidateId: candidate.id,
    });

    expect(response.status).toBe(409);
    expect(responseRecord(response.body).message).toBe(
      'The job does not have a requirements extraction.',
    );
  });

  it('rejects a candidate without an evidence extraction', async () => {
    evidence = null;
    const response = await request(apiUrl).post('/api/evaluations').send({
      jobId: job.id,
      candidateId: candidate.id,
    });

    expect(response.status).toBe(409);
    expect(responseRecord(response.body).message).toBe(
      'The candidate does not have an evidence extraction.',
    );
  });

  it('persists the relational evaluation and detailed result', async () => {
    const created = await request(apiUrl).post('/api/evaluations').send({
      jobId: job.id,
      candidateId: candidate.id,
    });

    expect(created.status).toBe(201);
    expect(responseRecord(created.body)).toMatchObject({
      id: 'evaluation-1',
      score: 0.7,
    });
    expect(createEvaluation).toHaveBeenCalledTimes(1);
    expect(evaluationResultStoreMock.upsert).toHaveBeenCalledTimes(1);

    const fetched = await request(apiUrl).get('/api/evaluations/evaluation-1');
    expect(fetched.status).toBe(200);
    expect(responseRecord(fetched.body)).toMatchObject({
      id: 'evaluation-1',
      result: { evaluationId: 'evaluation-1', score: 0.7 },
    });
  });

  it('returns a controlled error and compensates when document persistence fails', async () => {
    evaluationResultStoreMock.upsert.mockRejectedValueOnce(
      new ServiceUnavailableException('internal mongo detail'),
    );

    const response = await request(apiUrl).post('/api/evaluations').send({
      jobId: job.id,
      candidateId: candidate.id,
    });

    expect(response.status).toBe(503);
    expect(deleteEvaluation).toHaveBeenCalledWith({ where: { id: 'evaluation-1' } });
    expect(JSON.stringify(response.body)).not.toContain('internal mongo detail');
  });
});
