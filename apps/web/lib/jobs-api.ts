export type JobRequirementCategory =
  'technology' | 'skill' | 'experience' | 'education' | 'language' | 'other' | 'unknown';

export type JobRequirementLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'unknown';

export interface JobRequirement {
  category: JobRequirementCategory;
  evidenceText: string;
  level: JobRequirementLevel;
  name: string;
  required: boolean | null;
  years: number | null;
}

export interface JobRequirementsExtraction {
  extractedAt: string;
  jobId: string;
  provider: string;
  requirements: JobRequirement[];
}

export interface JobSummary {
  createdAt: string;
  description: string;
  id: string;
  title: string;
  updatedAt: string;
}

export interface JobDetail extends JobSummary {
  requirementsExtraction: JobRequirementsExtraction | null;
}

export interface CreateJobInput {
  description: string;
  title: string;
}

const CATEGORIES: readonly JobRequirementCategory[] = [
  'technology',
  'skill',
  'experience',
  'education',
  'language',
  'other',
  'unknown',
];

const LEVELS: readonly JobRequirementLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'unknown',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is JobRequirementCategory {
  return typeof value === 'string' && CATEGORIES.some((category) => category === value);
}

function isLevel(value: unknown): value is JobRequirementLevel {
  return typeof value === 'string' && LEVELS.some((level) => level === value);
}

function parseRequirement(value: unknown): JobRequirement {
  if (!isRecord(value)) {
    throw new Error('La API devolvió un requisito inválido.');
  }

  const { category, evidenceText, level, name, required, years } = value;
  if (
    typeof name !== 'string' ||
    typeof evidenceText !== 'string' ||
    !isCategory(category) ||
    !isLevel(level) ||
    (required !== null && typeof required !== 'boolean') ||
    (years !== null && typeof years !== 'number')
  ) {
    throw new Error('La API devolvió un requisito inválido.');
  }

  return {
    category,
    evidenceText,
    level,
    name,
    required,
    years,
  };
}

function parseExtraction(value: unknown): JobRequirementsExtraction {
  if (
    !isRecord(value) ||
    typeof value.extractedAt !== 'string' ||
    typeof value.jobId !== 'string' ||
    typeof value.provider !== 'string' ||
    !Array.isArray(value.requirements)
  ) {
    throw new Error('La API devolvió una extracción inválida.');
  }

  return {
    extractedAt: value.extractedAt,
    jobId: value.jobId,
    provider: value.provider,
    requirements: value.requirements.map(parseRequirement),
  };
}

function parseJob(value: unknown): JobSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new Error('La API devolvió una vacante inválida.');
  }

  return {
    createdAt: value.createdAt,
    description: value.description,
    id: value.id,
    title: value.title,
    updatedAt: value.updatedAt,
  };
}

export async function listJobs(accessToken?: string): Promise<JobSummary[]> {
  const payload = await apiRequest('/jobs', undefined, accessToken);
  if (!Array.isArray(payload)) {
    throw new Error('La API devolvió un listado inválido.');
  }
  return payload.map(parseJob);
}

export async function getJob(id: string, accessToken?: string): Promise<JobDetail> {
  const payload = await apiRequest(`/jobs/${encodeURIComponent(id)}`, undefined, accessToken);
  const job = parseJob(payload);
  if (!isRecord(payload)) {
    throw new Error('La API devolvió una vacante inválida.');
  }

  return {
    ...job,
    requirementsExtraction:
      payload.requirementsExtraction === null
        ? null
        : parseExtraction(payload.requirementsExtraction),
  };
}

export async function createJob(input: CreateJobInput): Promise<JobSummary> {
  const payload = await apiRequest('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return parseJob(payload);
}

export async function extractJobRequirements(id: string): Promise<JobRequirementsExtraction> {
  const payload = await apiRequest(`/jobs/${encodeURIComponent(id)}/extract-requirements`, {
    method: 'POST',
  });
  return parseExtraction(payload);
}
import { apiRequest } from './api-request';
