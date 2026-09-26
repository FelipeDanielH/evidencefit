import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AI_PROVIDER, type AiProvider } from '../src/ai/ai-provider.js';
import { InvalidCandidateEvidenceOutputError } from '../src/ai/candidate-evidence.parser.js';
import {
  CandidateEvidenceStore,
  type StoredCandidateEvidence,
} from '../src/candidates/candidate-evidence.store.js';
import { CandidatesController } from '../src/candidates/candidates.controller.js';
import { CandidatesService } from '../src/candidates/candidates.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { Candidate, Prisma } from '../src/generated/prisma/client.js';

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

describe('Candidates API', () => {
  let app: INestApplication;
  let apiUrl: string;
  let sequence = 0;
  const candidates = new Map<string, Candidate>();
  const extractions = new Map<string, StoredCandidateEvidence>();

  const createCandidate = jest.fn(({ data }: Prisma.CandidateCreateArgs): Promise<Candidate> => {
    sequence += 1;
    const now = new Date('2026-09-25T12:00:00.000Z');
    const candidate: Candidate = {
      id: `candidate-${sequence}`,
      name: data.name,
      cvText: data.cvText,
      createdAt: now,
      updatedAt: now,
    };
    candidates.set(candidate.id, candidate);
    return Promise.resolve(candidate);
  });

  const findCandidates = jest.fn((): Promise<Candidate[]> =>
    Promise.resolve(Array.from(candidates.values()).reverse()),
  );
  const findCandidate = jest.fn(
    ({ where }: Prisma.CandidateFindUniqueArgs): Promise<Candidate | null> => {
      if (typeof where.id !== 'string') return Promise.resolve(null);
      return Promise.resolve(candidates.get(where.id) ?? null);
    },
  );

  const prismaMock = {
    client: {
      candidate: {
        create: createCandidate,
        findMany: findCandidates,
        findUnique: findCandidate,
      },
    },
  };

  const findExtraction = jest.fn((candidateId: string): Promise<StoredCandidateEvidence | null> =>
    Promise.resolve(extractions.get(candidateId) ?? null),
  );
  const upsertExtraction = jest.fn(
    (extraction: StoredCandidateEvidence): Promise<StoredCandidateEvidence> => {
      extractions.set(extraction.candidateId, extraction);
      return Promise.resolve(extraction);
    },
  );
  const evidenceStoreMock = {
    findByCandidateId: findExtraction,
    upsert: upsertExtraction,
  };

  const extractCandidateEvidence = jest.fn<AiProvider['extractCandidateEvidence']>();
  const extractJobRequirements = jest.fn<AiProvider['extractJobRequirements']>();
  const aiProviderMock: AiProvider = {
    name: 'mock-provider',
    extractCandidateEvidence,
    extractJobRequirements,
    isConfigured: () => true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CandidatesController],
      providers: [
        CandidatesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CandidateEvidenceStore, useValue: evidenceStoreMock },
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
    candidates.clear();
    extractions.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSyntheticCandidate(): Promise<string> {
    const response = await request(apiUrl).post('/api/candidates').send({
      name: 'Alex Sintético',
      cvText: 'Proyecto personal: Desarrollé una API REST utilizando NestJS.',
      isSynthetic: true,
    });
    return getResponseId(response.body);
  }

  it('creates a synthetic candidate', async () => {
    const response = await request(apiUrl).post('/api/candidates').send({
      name: 'Alex Sintético',
      cvText: 'Skills: TypeScript, NestJS y PostgreSQL. Perfil completamente sintético.',
      isSynthetic: true,
    });

    expect(response.status).toBe(201);
    expect(getResponseRecord(response.body)).toMatchObject({
      id: 'candidate-1',
      name: 'Alex Sintético',
    });
    expect(createCandidate).toHaveBeenCalledTimes(1);
  });

  it('gets a candidate and its current evidence extraction', async () => {
    const id = await createSyntheticCandidate();
    const response = await request(apiUrl).get(`/api/candidates/${id}`);

    expect(response.status).toBe(200);
    expect(getResponseRecord(response.body)).toMatchObject({
      id: 'candidate-1',
      evidenceExtraction: null,
    });
  });

  it('extracts, validates, and persists evidence with the mocked provider', async () => {
    const id = await createSyntheticCandidate();
    extractCandidateEvidence.mockResolvedValueOnce({
      evidence: [
        {
          skill: 'NestJS',
          category: 'technology',
          evidenceLevel: 'medium',
          years: null,
          evidenceText: 'Desarrollé una API REST utilizando NestJS',
          sourceType: 'project',
          confidence: 0.78,
        },
      ],
    });

    const response = await request(apiUrl).post(`/api/candidates/${id}/extract-evidence`);

    expect(response.status).toBe(201);
    expect(getResponseRecord(response.body).evidence).toEqual([
      expect.objectContaining({ skill: 'NestJS', sourceType: 'project', years: null }),
    ]);
    expect(upsertExtraction).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid provider output without persisting it', async () => {
    const id = await createSyntheticCandidate();
    extractCandidateEvidence.mockRejectedValueOnce(
      new InvalidCandidateEvidenceOutputError('invalid output detail'),
    );

    const response = await request(apiUrl).post(`/api/candidates/${id}/extract-evidence`);

    expect(response.status).toBe(502);
    expect(getResponseRecord(response.body).message).toBe(
      'The AI provider returned invalid candidate evidence.',
    );
    expect(upsertExtraction).not.toHaveBeenCalled();
  });

  it('rejects evidence text absent from the CV', async () => {
    const id = await createSyntheticCandidate();
    extractCandidateEvidence.mockResolvedValueOnce({
      evidence: [
        {
          skill: 'Kubernetes',
          category: 'technology',
          evidenceLevel: 'strong',
          years: 5,
          evidenceText: 'Lideré Kubernetes en producción durante 5 años',
          sourceType: 'professional_experience',
          confidence: 0.99,
        },
      ],
    });

    const response = await request(apiUrl).post(`/api/candidates/${id}/extract-evidence`);

    expect(response.status).toBe(502);
    expect(upsertExtraction).not.toHaveBeenCalled();
  });

  it('returns a controlled provider failure', async () => {
    const id = await createSyntheticCandidate();
    extractCandidateEvidence.mockRejectedValueOnce(new Error('provider secret detail'));

    const response = await request(apiUrl).post(`/api/candidates/${id}/extract-evidence`);

    expect(response.status).toBe(503);
    const body = getResponseRecord(response.body);
    expect(body.message).toBe('Candidate evidence could not be extracted.');
    expect(JSON.stringify(body)).not.toContain('provider secret detail');
  });
});
