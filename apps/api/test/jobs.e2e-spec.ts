import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Job, Prisma } from '../src/generated/prisma/client.js';
import request from 'supertest';
import { AI_PROVIDER, type AiProvider } from '../src/ai/ai-provider.js';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  JobRequirementsStore,
  type StoredJobRequirements,
} from '../src/jobs/job-requirements.store.js';
import { JobsController } from '../src/jobs/jobs.controller.js';
import { JobsService } from '../src/jobs/jobs.service.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getResponseRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected a JSON object response.');
  }
  return value;
}

function getResponseId(value: unknown): string {
  const record = getResponseRecord(value);
  if (typeof record.id !== 'string') {
    throw new Error('Expected a response id.');
  }
  return record.id;
}

describe('Jobs API', () => {
  let app: INestApplication;
  let apiUrl: string;
  let sequence = 0;
  const jobs = new Map<string, Job>();
  const extractions = new Map<string, StoredJobRequirements>();

  const createJob = jest.fn(({ data }: Prisma.JobCreateArgs): Promise<Job> => {
    sequence += 1;
    const now = new Date('2026-09-25T12:00:00.000Z');
    const job: Job = {
      id: `job-${sequence}`,
      title: data.title,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };
    jobs.set(job.id, job);
    return Promise.resolve(job);
  });

  const findJobs = jest.fn((): Promise<Job[]> =>
    Promise.resolve(Array.from(jobs.values()).reverse()),
  );
  const findJob = jest.fn(({ where }: Prisma.JobFindUniqueArgs): Promise<Job | null> => {
    if (typeof where.id !== 'string') return Promise.resolve(null);
    return Promise.resolve(jobs.get(where.id) ?? null);
  });

  const prismaMock = {
    client: {
      job: {
        create: createJob,
        findMany: findJobs,
        findUnique: findJob,
      },
    },
  };

  const findExtraction = jest.fn((jobId: string): Promise<StoredJobRequirements | null> =>
    Promise.resolve(extractions.get(jobId) ?? null),
  );
  const upsertExtraction = jest.fn(
    (extraction: StoredJobRequirements): Promise<StoredJobRequirements> => {
      extractions.set(extraction.jobId, extraction);
      return Promise.resolve(extraction);
    },
  );
  const requirementsStoreMock = {
    findByJobId: findExtraction,
    upsert: upsertExtraction,
  };

  const extractJobRequirements = jest.fn<AiProvider['extractJobRequirements']>();
  const extractCandidateEvidence = jest.fn<AiProvider['extractCandidateEvidence']>();
  const aiProviderMock: AiProvider = {
    name: 'mock-provider',
    extractCandidateEvidence,
    extractJobRequirements,
    isConfigured: () => true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JobRequirementsStore, useValue: requirementsStoreMock },
        { provide: AI_PROVIDER, useValue: aiProviderMock },
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
    sequence = 0;
    jobs.clear();
    extractions.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a job', async () => {
    const response = await request(apiUrl).post('/api/jobs').send({
      title: 'Backend Engineer',
      description: 'Buscamos experiencia comprobable desarrollando APIs con NestJS.',
    });

    expect(response.status).toBe(201);
    expect(getResponseRecord(response.body)).toMatchObject({
      id: 'job-1',
      title: 'Backend Engineer',
    });
    expect(createJob).toHaveBeenCalledTimes(1);
  });

  it('gets a job and its current extraction', async () => {
    const created = await request(apiUrl).post('/api/jobs').send({
      title: 'Backend Engineer',
      description: 'Buscamos experiencia comprobable desarrollando APIs con NestJS.',
    });

    const response = await request(apiUrl).get(`/api/jobs/${getResponseId(created.body)}`);

    expect(response.status).toBe(200);
    expect(getResponseRecord(response.body)).toMatchObject({
      id: 'job-1',
      requirementsExtraction: null,
    });
  });

  it('extracts and persists requirements using the mocked AiProvider', async () => {
    const created = await request(apiUrl).post('/api/jobs').send({
      title: 'Backend Engineer',
      description: 'NestJS avanzado es obligatorio y se requieren 2 años de experiencia.',
    });
    extractJobRequirements.mockResolvedValueOnce({
      requirements: [
        {
          name: 'NestJS',
          category: 'technology',
          level: 'advanced',
          required: true,
          years: 2,
          evidenceText: 'NestJS avanzado es obligatorio y se requieren 2 años de experiencia.',
        },
      ],
    });

    const response = await request(apiUrl).post(
      `/api/jobs/${getResponseId(created.body)}/extract-requirements`,
    );

    expect(response.status).toBe(201);
    const responseBody = getResponseRecord(response.body);
    expect(responseBody.requirements).toEqual([
      expect.objectContaining({ name: 'NestJS', years: 2 }),
    ]);
    expect(upsertExtraction).toHaveBeenCalledTimes(1);
  });

  it('returns a controlled provider failure', async () => {
    const created = await request(apiUrl).post('/api/jobs').send({
      title: 'Backend Engineer',
      description: 'Buscamos experiencia comprobable desarrollando APIs con NestJS.',
    });
    extractJobRequirements.mockRejectedValueOnce(new Error('provider secret detail'));

    const response = await request(apiUrl).post(
      `/api/jobs/${getResponseId(created.body)}/extract-requirements`,
    );

    expect(response.status).toBe(503);
    const responseBody = getResponseRecord(response.body);
    expect(responseBody.message).toBe('Job requirements could not be extracted.');
    expect(JSON.stringify(responseBody)).not.toContain('provider secret detail');
  });
});
