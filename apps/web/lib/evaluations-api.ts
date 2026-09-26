import type {
  CandidateEvidenceCategory,
  CandidateEvidenceLevel,
  CandidateEvidenceSourceType,
} from './candidates-api';
import type { JobRequirementCategory, JobRequirementLevel } from './jobs-api';
import { apiRequest } from './api-request';

export type MatchStatus = 'strong' | 'medium' | 'weak' | 'unknown' | 'not_found';

export interface EvaluationRequirement {
  category: JobRequirementCategory;
  level: JobRequirementLevel;
  name: string;
  required: boolean | null;
  years: number | null;
}

export interface MatchedEvidence {
  category: CandidateEvidenceCategory;
  confidence: number;
  evidenceLevel: CandidateEvidenceLevel;
  sourceType: CandidateEvidenceSourceType;
  text: string;
  years: number | null;
}

export interface RequirementMatch {
  confidence: number;
  explanation: string;
  matchedEvidence: MatchedEvidence[];
  missingInformation: string[];
  requirement: EvaluationRequirement;
  status: MatchStatus;
}

export interface EvaluationResult {
  candidateId: string;
  evaluatedAt: string;
  evaluationId: string;
  jobId: string;
  matches: RequirementMatch[];
  score: number | null;
}

export interface EvaluationDetail {
  candidateId: string;
  createdAt: string;
  id: string;
  jobId: string;
  result: EvaluationResult;
  score: number | null;
  updatedAt: string;
}

const MATCH_STATUSES: readonly MatchStatus[] = ['strong', 'medium', 'weak', 'unknown', 'not_found'];
const JOB_CATEGORIES: readonly JobRequirementCategory[] = [
  'technology',
  'skill',
  'experience',
  'education',
  'language',
  'other',
  'unknown',
];
const JOB_LEVELS: readonly JobRequirementLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'unknown',
];
const EVIDENCE_CATEGORIES: readonly CandidateEvidenceCategory[] = JOB_CATEGORIES;
const EVIDENCE_LEVELS: readonly CandidateEvidenceLevel[] = ['strong', 'medium', 'weak', 'unknown'];
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

function isMatchStatus(value: unknown): value is MatchStatus {
  return typeof value === 'string' && MATCH_STATUSES.some((status) => status === value);
}

function isJobCategory(value: unknown): value is JobRequirementCategory {
  return typeof value === 'string' && JOB_CATEGORIES.some((category) => category === value);
}

function isJobLevel(value: unknown): value is JobRequirementLevel {
  return typeof value === 'string' && JOB_LEVELS.some((level) => level === value);
}

function isEvidenceCategory(value: unknown): value is CandidateEvidenceCategory {
  return typeof value === 'string' && EVIDENCE_CATEGORIES.some((category) => category === value);
}

function isEvidenceLevel(value: unknown): value is CandidateEvidenceLevel {
  return typeof value === 'string' && EVIDENCE_LEVELS.some((level) => level === value);
}

function isSourceType(value: unknown): value is CandidateEvidenceSourceType {
  return typeof value === 'string' && SOURCE_TYPES.some((sourceType) => sourceType === value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function parseRequirement(value: unknown): EvaluationRequirement {
  if (
    !isRecord(value) ||
    !isJobCategory(value.category) ||
    !isJobLevel(value.level) ||
    typeof value.name !== 'string' ||
    (value.required !== null && typeof value.required !== 'boolean') ||
    !isNullableNumber(value.years)
  ) {
    throw new Error('La API devolvió un requisito evaluado inválido.');
  }
  return {
    category: value.category,
    level: value.level,
    name: value.name,
    required: value.required,
    years: value.years,
  };
}

function parseMatchedEvidence(value: unknown): MatchedEvidence {
  if (
    !isRecord(value) ||
    !isEvidenceCategory(value.category) ||
    typeof value.confidence !== 'number' ||
    !isEvidenceLevel(value.evidenceLevel) ||
    !isSourceType(value.sourceType) ||
    typeof value.text !== 'string' ||
    !isNullableNumber(value.years)
  ) {
    throw new Error('La API devolvió evidencia evaluada inválida.');
  }
  return {
    category: value.category,
    confidence: value.confidence,
    evidenceLevel: value.evidenceLevel,
    sourceType: value.sourceType,
    text: value.text,
    years: value.years,
  };
}

function parseMatch(value: unknown): RequirementMatch {
  if (
    !isRecord(value) ||
    typeof value.confidence !== 'number' ||
    typeof value.explanation !== 'string' ||
    !Array.isArray(value.matchedEvidence) ||
    !Array.isArray(value.missingInformation) ||
    !value.missingInformation.every((item) => typeof item === 'string') ||
    !isMatchStatus(value.status)
  ) {
    throw new Error('La API devolvió un matching inválido.');
  }
  return {
    confidence: value.confidence,
    explanation: value.explanation,
    matchedEvidence: value.matchedEvidence.map(parseMatchedEvidence),
    missingInformation: value.missingInformation,
    requirement: parseRequirement(value.requirement),
    status: value.status,
  };
}

function parseResult(value: unknown): EvaluationResult {
  if (
    !isRecord(value) ||
    typeof value.candidateId !== 'string' ||
    typeof value.evaluatedAt !== 'string' ||
    typeof value.evaluationId !== 'string' ||
    typeof value.jobId !== 'string' ||
    !Array.isArray(value.matches) ||
    !isNullableNumber(value.score)
  ) {
    throw new Error('La API devolvió un resultado de evaluación inválido.');
  }
  return {
    candidateId: value.candidateId,
    evaluatedAt: value.evaluatedAt,
    evaluationId: value.evaluationId,
    jobId: value.jobId,
    matches: value.matches.map(parseMatch),
    score: value.score,
  };
}

function parseEvaluation(value: unknown): EvaluationDetail {
  if (
    !isRecord(value) ||
    typeof value.candidateId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.id !== 'string' ||
    typeof value.jobId !== 'string' ||
    !isNullableNumber(value.score) ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new Error('La API devolvió una evaluación inválida.');
  }
  return {
    candidateId: value.candidateId,
    createdAt: value.createdAt,
    id: value.id,
    jobId: value.jobId,
    result: parseResult(value.result),
    score: value.score,
    updatedAt: value.updatedAt,
  };
}

export async function createEvaluation(input: {
  candidateId: string;
  jobId: string;
}): Promise<EvaluationDetail> {
  return parseEvaluation(
    await apiRequest('/evaluations', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function getEvaluation(id: string, accessToken?: string): Promise<EvaluationDetail> {
  return parseEvaluation(
    await apiRequest(`/evaluations/${encodeURIComponent(id)}`, undefined, accessToken),
  );
}
