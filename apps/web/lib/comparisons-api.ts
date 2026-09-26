import type {
  CandidateEvidenceCategory,
  CandidateEvidenceLevel,
  CandidateEvidenceSourceType,
} from './candidates-api';
import type { MatchStatus, MatchedEvidence } from './evaluations-api';
import type { JobRequirementCategory, JobRequirementLevel } from './jobs-api';
import { apiRequest } from './api-request';

export interface ComparisonEvaluationOption {
  candidateId: string;
  candidateName: string;
  createdAt: string;
  evaluationId: string;
  score: number | null;
}

export interface ComparisonSelection {
  evaluations: ComparisonEvaluationOption[];
  job: { id: string; title: string };
}

export interface ComparisonCandidate {
  candidateId: string;
  evaluationId: string;
  name: string;
  score: number | null;
  scoreTied: boolean;
}

export interface CandidateRequirementComparison {
  candidateId: string;
  confidence: number;
  evaluationId: string;
  evidence: MatchedEvidence[];
  explanation: string;
  hasRequiredGap: boolean;
  isStrength: boolean;
  isUnknown: boolean;
  missingInformation: string[];
  status: MatchStatus;
}

export interface ComparedRequirement {
  category: JobRequirementCategory;
  level: JobRequirementLevel;
  name: string;
  required: boolean | null;
  results: CandidateRequirementComparison[];
  years: number | null;
}

export interface JobComparison {
  candidates: ComparisonCandidate[];
  job: { id: string; title: string };
  requirements: ComparedRequirement[];
}

const MATCH_STATUSES: readonly MatchStatus[] = ['strong', 'medium', 'weak', 'unknown', 'not_found'];
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

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isStatus(value: unknown): value is MatchStatus {
  return typeof value === 'string' && MATCH_STATUSES.some((status) => status === value);
}

function isCategory(value: unknown): value is JobRequirementCategory & CandidateEvidenceCategory {
  return typeof value === 'string' && CATEGORIES.some((category) => category === value);
}

function isLevel(value: unknown): value is JobRequirementLevel {
  return typeof value === 'string' && LEVELS.some((level) => level === value);
}

function isEvidenceLevel(value: unknown): value is CandidateEvidenceLevel {
  return typeof value === 'string' && EVIDENCE_LEVELS.some((level) => level === value);
}

function isSourceType(value: unknown): value is CandidateEvidenceSourceType {
  return typeof value === 'string' && SOURCE_TYPES.some((sourceType) => sourceType === value);
}

function parseJob(value: unknown): { id: string; title: string } {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    throw new Error('La API devolvió una vacante inválida.');
  }
  return { id: value.id, title: value.title };
}

function parseOption(value: unknown): ComparisonEvaluationOption {
  if (
    !isRecord(value) ||
    typeof value.candidateId !== 'string' ||
    typeof value.candidateName !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.evaluationId !== 'string' ||
    !isNullableNumber(value.score)
  ) {
    throw new Error('La API devolvió una opción de evaluación inválida.');
  }
  return {
    candidateId: value.candidateId,
    candidateName: value.candidateName,
    createdAt: value.createdAt,
    evaluationId: value.evaluationId,
    score: value.score,
  };
}

function parseCandidate(value: unknown): ComparisonCandidate {
  if (
    !isRecord(value) ||
    typeof value.candidateId !== 'string' ||
    typeof value.evaluationId !== 'string' ||
    typeof value.name !== 'string' ||
    !isNullableNumber(value.score) ||
    typeof value.scoreTied !== 'boolean'
  ) {
    throw new Error('La API devolvió un candidato comparado inválido.');
  }
  return {
    candidateId: value.candidateId,
    evaluationId: value.evaluationId,
    name: value.name,
    score: value.score,
    scoreTied: value.scoreTied,
  };
}

function parseEvidence(value: unknown): MatchedEvidence {
  if (
    !isRecord(value) ||
    !isCategory(value.category) ||
    typeof value.confidence !== 'number' ||
    !isEvidenceLevel(value.evidenceLevel) ||
    !isSourceType(value.sourceType) ||
    typeof value.text !== 'string' ||
    !isNullableNumber(value.years)
  ) {
    throw new Error('La API devolvió evidencia comparada inválida.');
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

function parseCandidateResult(value: unknown): CandidateRequirementComparison {
  if (
    !isRecord(value) ||
    typeof value.candidateId !== 'string' ||
    typeof value.confidence !== 'number' ||
    typeof value.evaluationId !== 'string' ||
    !Array.isArray(value.evidence) ||
    typeof value.explanation !== 'string' ||
    typeof value.hasRequiredGap !== 'boolean' ||
    typeof value.isStrength !== 'boolean' ||
    typeof value.isUnknown !== 'boolean' ||
    !Array.isArray(value.missingInformation) ||
    !value.missingInformation.every((item) => typeof item === 'string') ||
    !isStatus(value.status)
  ) {
    throw new Error('La API devolvió un resultado comparado inválido.');
  }
  return {
    candidateId: value.candidateId,
    confidence: value.confidence,
    evaluationId: value.evaluationId,
    evidence: value.evidence.map(parseEvidence),
    explanation: value.explanation,
    hasRequiredGap: value.hasRequiredGap,
    isStrength: value.isStrength,
    isUnknown: value.isUnknown,
    missingInformation: value.missingInformation,
    status: value.status,
  };
}

function parseRequirement(value: unknown): ComparedRequirement {
  if (
    !isRecord(value) ||
    !isCategory(value.category) ||
    !isLevel(value.level) ||
    typeof value.name !== 'string' ||
    (value.required !== null && typeof value.required !== 'boolean') ||
    !Array.isArray(value.results) ||
    !isNullableNumber(value.years)
  ) {
    throw new Error('La API devolvió un requisito comparado inválido.');
  }
  return {
    category: value.category,
    level: value.level,
    name: value.name,
    required: value.required,
    results: value.results.map(parseCandidateResult),
    years: value.years,
  };
}

export async function listJobEvaluations(
  jobId: string,
  accessToken?: string,
): Promise<ComparisonSelection> {
  const payload = await apiRequest(
    `/jobs/${encodeURIComponent(jobId)}/evaluations`,
    undefined,
    accessToken,
  );
  if (!isRecord(payload) || !Array.isArray(payload.evaluations)) {
    throw new Error('La API devolvió evaluaciones inválidas.');
  }
  return {
    evaluations: payload.evaluations.map(parseOption),
    job: parseJob(payload.job),
  };
}

export async function compareJobEvaluations(
  jobId: string,
  evaluationIds: string[],
  accessToken?: string,
): Promise<JobComparison> {
  const query = new URLSearchParams({ evaluationIds: evaluationIds.join(',') });
  const payload = await apiRequest(
    `/jobs/${encodeURIComponent(jobId)}/comparison?${query.toString()}`,
    undefined,
    accessToken,
  );
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.candidates) ||
    !Array.isArray(payload.requirements)
  ) {
    throw new Error('La API devolvió una comparación inválida.');
  }
  return {
    candidates: payload.candidates.map(parseCandidate),
    job: parseJob(payload.job),
    requirements: payload.requirements.map(parseRequirement),
  };
}
