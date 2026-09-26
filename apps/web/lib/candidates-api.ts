export type CandidateEvidenceCategory =
  'technology' | 'skill' | 'experience' | 'education' | 'language' | 'other' | 'unknown';

export type CandidateEvidenceLevel = 'strong' | 'medium' | 'weak' | 'unknown';

export type CandidateEvidenceSourceType =
  'professional_experience' | 'project' | 'education' | 'skills_section' | 'other' | 'unknown';

export interface CandidateEvidence {
  category: CandidateEvidenceCategory;
  confidence: number;
  evidenceLevel: CandidateEvidenceLevel;
  evidenceText: string;
  skill: string;
  sourceType: CandidateEvidenceSourceType;
  years: number | null;
}

export interface CandidateEvidenceExtraction {
  candidateId: string;
  evidence: CandidateEvidence[];
  extractedAt: string;
  provider: string;
}

export interface CandidateSummary {
  createdAt: string;
  cvText: string;
  id: string;
  name: string;
  updatedAt: string;
}

export interface CandidateDetail extends CandidateSummary {
  evidenceExtraction: CandidateEvidenceExtraction | null;
}

export interface CreateCandidateInput {
  cvText: string;
  isSynthetic: true;
  name: string;
}

const CATEGORIES: readonly CandidateEvidenceCategory[] = [
  'technology',
  'skill',
  'experience',
  'education',
  'language',
  'other',
  'unknown',
];
const LEVELS: readonly CandidateEvidenceLevel[] = ['strong', 'medium', 'weak', 'unknown'];
const SOURCE_TYPES: readonly CandidateEvidenceSourceType[] = [
  'professional_experience',
  'project',
  'education',
  'skills_section',
  'other',
  'unknown',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is CandidateEvidenceCategory {
  return typeof value === 'string' && CATEGORIES.some((category) => category === value);
}

function isLevel(value: unknown): value is CandidateEvidenceLevel {
  return typeof value === 'string' && LEVELS.some((level) => level === value);
}

function isSourceType(value: unknown): value is CandidateEvidenceSourceType {
  return typeof value === 'string' && SOURCE_TYPES.some((sourceType) => sourceType === value);
}

function parseEvidence(value: unknown): CandidateEvidence {
  if (!isRecord(value)) {
    throw new Error('La API devolvió evidencia inválida.');
  }
  const { category, confidence, evidenceLevel, evidenceText, skill, sourceType, years } = value;
  if (
    !isCategory(category) ||
    typeof confidence !== 'number' ||
    !isLevel(evidenceLevel) ||
    typeof evidenceText !== 'string' ||
    typeof skill !== 'string' ||
    !isSourceType(sourceType) ||
    (years !== null && typeof years !== 'number')
  ) {
    throw new Error('La API devolvió evidencia inválida.');
  }
  return { category, confidence, evidenceLevel, evidenceText, skill, sourceType, years };
}

function parseExtraction(value: unknown): CandidateEvidenceExtraction {
  if (
    !isRecord(value) ||
    typeof value.candidateId !== 'string' ||
    typeof value.extractedAt !== 'string' ||
    typeof value.provider !== 'string' ||
    !Array.isArray(value.evidence)
  ) {
    throw new Error('La API devolvió una extracción inválida.');
  }
  return {
    candidateId: value.candidateId,
    evidence: value.evidence.map(parseEvidence),
    extractedAt: value.extractedAt,
    provider: value.provider,
  };
}

function parseCandidate(value: unknown): CandidateSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.cvText !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new Error('La API devolvió un candidato inválido.');
  }
  return {
    createdAt: value.createdAt,
    cvText: value.cvText,
    id: value.id,
    name: value.name,
    updatedAt: value.updatedAt,
  };
}

export async function listCandidates(accessToken?: string): Promise<CandidateSummary[]> {
  const payload = await apiRequest('/candidates', undefined, accessToken);
  if (!Array.isArray(payload)) throw new Error('La API devolvió un listado inválido.');
  return payload.map(parseCandidate);
}

export async function getCandidate(id: string, accessToken?: string): Promise<CandidateDetail> {
  const payload = await apiRequest(`/candidates/${encodeURIComponent(id)}`, undefined, accessToken);
  const candidate = parseCandidate(payload);
  if (!isRecord(payload)) throw new Error('La API devolvió un candidato inválido.');
  return {
    ...candidate,
    evidenceExtraction:
      payload.evidenceExtraction === null ? null : parseExtraction(payload.evidenceExtraction),
  };
}

export async function createCandidate(input: CreateCandidateInput): Promise<CandidateSummary> {
  return parseCandidate(
    await apiRequest('/candidates', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function extractCandidateEvidence(id: string): Promise<CandidateEvidenceExtraction> {
  return parseExtraction(
    await apiRequest(`/candidates/${encodeURIComponent(id)}/extract-evidence`, {
      method: 'POST',
    }),
  );
}
import { apiRequest } from './api-request';
