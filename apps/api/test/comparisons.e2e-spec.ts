import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { ComparisonService } from '../src/evaluations/comparison.service.js';
import { ComparisonsController } from '../src/evaluations/comparisons.controller.js';
import {
  EvaluationResultStore,
  type StoredEvaluationResult,
} from '../src/evaluations/evaluation-result.store.js';
import type { MatchStatus, RequirementMatch } from '../src/evaluations/evaluation.types.js';
import type { Evaluation, Job, Prisma } from '../src/generated/prisma/client.js';

interface TestEvaluation extends Evaluation {
  candidate: {
    id: string;
    name: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function responseRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a JSON object response.');
  return value;
}

function requirementMatch(status: MatchStatus): RequirementMatch {
  const hasEvidence = status !== 'not_found';
  return {
    confidence: hasEvidence ? 0.8 : 0,
    explanation: `Resultado ${status}`,
    matchedEvidence: hasEvidence
      ? [
          {
            category: 'technology',
            confidence: 0.8,
            evidenceLevel: status === 'unknown' ? 'unknown' : status,
            sourceType: status === 'weak' ? 'skills_section' : 'project',
            text: 'Evidencia sintética de NestJS',
            years: null,
          },
        ]
      : [],
    missingInformation:
      status === 'strong' ? [] : ['No se pudo acreditar completamente el requisito.'],
    requirement: {
      category: 'technology',
      level: 'unknown',
      name: 'NestJS',
      required: true,
      years: 2,
    },
    status,
  };
}

describe('Job comparisons API', () => {
  let app: INestApplication;
  let apiUrl: string;
  const now = new Date('2026-09-25T14:00:00.000Z');
  const job: Job = {
    id: 'job-1',
    title: 'Backend Engineer',
    description: 'NestJS',
    createdAt: now,
    updatedAt: now,
  };
  const otherJob: Job = {
    ...job,
    id: 'job-2',
    title: 'Frontend Engineer',
  };
  const evaluations: TestEvaluation[] = [
    {
      id: 'evaluation-1',
      jobId: job.id,
      candidateId: 'candidate-1',
      score: 0.8,
      createdAt: now,
      updatedAt: now,
      candidate: { id: 'candidate-1', name: 'Candidate A' },
    },
    {
      id: 'evaluation-2',
      jobId: job.id,
      candidateId: 'candidate-2',
      score: 0.8,
      createdAt: now,
      updatedAt: now,
      candidate: { id: 'candidate-2', name: 'Candidate B' },
    },
    {
      id: 'evaluation-3',
      jobId: job.id,
      candidateId: 'candidate-3',
      score: 0.4,
      createdAt: now,
      updatedAt: now,
      candidate: { id: 'candidate-3', name: 'Candidate C' },
    },
    {
      id: 'evaluation-4',
      jobId: otherJob.id,
      candidateId: 'candidate-4',
      score: 1,
      createdAt: now,
      updatedAt: now,
      candidate: { id: 'candidate-4', name: 'Candidate D' },
    },
  ];
  const storedResults = new Map<string, StoredEvaluationResult>();

  const findJob = jest.fn(({ where }: Prisma.JobFindUniqueArgs): Promise<Job | null> => {
    if (where.id === job.id) return Promise.resolve(job);
    if (where.id === otherJob.id) return Promise.resolve(otherJob);
    return Promise.resolve(null);
  });
  const findEvaluations = jest.fn(
    (args: Prisma.EvaluationFindManyArgs): Promise<TestEvaluation[]> => {
      if (args.where?.jobId === job.id) {
        return Promise.resolve(evaluations.filter((evaluation) => evaluation.jobId === job.id));
      }
      const idFilter: unknown = args.where?.id;
      if (isRecord(idFilter) && isStringArray(idFilter.in)) {
        const requestedIds = idFilter.in;
        return Promise.resolve(
          evaluations.filter((evaluation) => requestedIds.includes(evaluation.id)),
        );
      }
      return Promise.resolve([]);
    },
  );
  const prismaMock = {
    client: {
      evaluation: { findMany: findEvaluations },
      job: { findUnique: findJob },
    },
  };
  const resultStoreMock = {
    findByEvaluationIds: jest.fn((ids: string[]): Promise<StoredEvaluationResult[]> =>
      Promise.resolve(
        ids
          .map((id) => storedResults.get(id))
          .filter((result): result is StoredEvaluationResult => result !== undefined),
      ),
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ComparisonsController],
      providers: [
        ComparisonService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EvaluationResultStore, useValue: resultStoreMock },
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
    storedResults.clear();
    const statuses: MatchStatus[] = ['strong', 'not_found', 'unknown', 'strong'];
    evaluations.forEach((evaluation, index) => {
      storedResults.set(evaluation.id, {
        candidateId: evaluation.candidateId,
        evaluatedAt: now.toISOString(),
        evaluationId: evaluation.id,
        jobId: evaluation.jobId,
        matches: [requirementMatch(statuses[index] ?? 'unknown')],
        score: evaluation.score,
      });
    });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  async function compare(ids: string[]) {
    return request(apiUrl)
      .get(`/api/jobs/${job.id}/comparison`)
      .query({ evaluationIds: ids.join(',') });
  }

  it('compares two evaluated candidates', async () => {
    const response = await compare(['evaluation-1', 'evaluation-2']);

    expect(response.status).toBe(200);
    expect(responseRecord(response.body)).toMatchObject({
      job: { id: job.id, title: job.title },
      candidates: [
        { candidateId: 'candidate-1', name: 'Candidate A' },
        { candidateId: 'candidate-2', name: 'Candidate B' },
      ],
    });
  });

  it('compares three or more candidates', async () => {
    const response = await compare(['evaluation-1', 'evaluation-2', 'evaluation-3']);

    expect(response.status).toBe(200);
    expect(responseRecord(response.body).candidates).toHaveLength(3);
  });

  it('rejects fewer than two evaluations', async () => {
    const response = await compare(['evaluation-1']);

    expect(response.status).toBe(400);
    expect(responseRecord(response.body).message).toBe('At least two evaluationIds are required.');
  });

  it('rejects an evaluation from another job', async () => {
    const response = await compare(['evaluation-1', 'evaluation-4']);

    expect(response.status).toBe(400);
    expect(responseRecord(response.body).message).toBe(
      'All evaluations must belong to the requested job.',
    );
  });

  it('marks score ties without declaring a winner', async () => {
    const response = await compare(['evaluation-1', 'evaluation-2']);
    const candidates = responseRecord(response.body).candidates;

    expect(candidates).toEqual([
      expect.objectContaining({ evaluationId: 'evaluation-1', scoreTied: true }),
      expect.objectContaining({ evaluationId: 'evaluation-2', scoreTied: true }),
    ]);
  });

  it('preserves strong and not_found statuses', async () => {
    const response = await compare(['evaluation-1', 'evaluation-2']);
    const requirements = responseRecord(response.body).requirements;

    expect(requirements).toEqual([
      expect.objectContaining({
        results: [
          expect.objectContaining({ status: 'strong', isStrength: true }),
          expect.objectContaining({ status: 'not_found', hasRequiredGap: true }),
        ],
      }),
    ]);
  });

  it('preserves unknown as insufficient information', async () => {
    const response = await compare(['evaluation-1', 'evaluation-3']);
    const requirements = responseRecord(response.body).requirements;
    expect(Array.isArray(requirements)).toBe(true);
    if (!Array.isArray(requirements)) throw new Error('Expected comparison requirements.');
    const firstRequirement = responseRecord(requirements[0]);
    const results = firstRequirement.results;
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) throw new Error('Expected comparison results.');
    const unknownResult = results
      .map(responseRecord)
      .find((result) => result.candidateId === 'candidate-3');

    expect(unknownResult).toMatchObject({
      status: 'unknown',
      isUnknown: true,
      hasRequiredGap: false,
    });
  });

  it('identifies a gap in a mandatory requirement', async () => {
    const response = await compare(['evaluation-1', 'evaluation-2']);
    const requirements = responseRecord(response.body).requirements;
    expect(Array.isArray(requirements)).toBe(true);
    if (!Array.isArray(requirements)) throw new Error('Expected comparison requirements.');
    const firstRequirement = responseRecord(requirements[0]);
    const results = firstRequirement.results;
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) throw new Error('Expected comparison results.');
    const gapResult = results
      .map(responseRecord)
      .find((result) => result.candidateId === 'candidate-2');

    expect(firstRequirement.required).toBe(true);
    expect(gapResult).toMatchObject({ hasRequiredGap: true });
  });

  it('keeps selection order stable when scores are tied', async () => {
    const response = await compare(['evaluation-2', 'evaluation-1', 'evaluation-3']);
    const candidates = responseRecord(response.body).candidates;

    expect(candidates).toEqual([
      expect.objectContaining({ evaluationId: 'evaluation-2' }),
      expect.objectContaining({ evaluationId: 'evaluation-1' }),
      expect.objectContaining({ evaluationId: 'evaluation-3' }),
    ]);
  });

  it('rejects a missing evaluation result document', async () => {
    storedResults.delete('evaluation-2');
    const response = await compare(['evaluation-1', 'evaluation-2']);

    expect(response.status).toBe(404);
    expect(responseRecord(response.body).message).toBe(
      'Evaluation result was not found for evaluation evaluation-2.',
    );
  });
});
