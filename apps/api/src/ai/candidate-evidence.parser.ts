import {
  CANDIDATE_EVIDENCE_CATEGORIES,
  CANDIDATE_EVIDENCE_LEVELS,
  CANDIDATE_EVIDENCE_SOURCE_TYPES,
  type CandidateEvidence,
  type CandidateEvidenceCategory,
  type CandidateEvidenceLevel,
  type CandidateEvidenceSourceType,
  type ExtractedCandidateEvidence,
} from './candidate-evidence.types.js';

const ROOT_KEYS = ['evidence'];
const EVIDENCE_KEYS = [
  'skill',
  'category',
  'evidenceLevel',
  'years',
  'evidenceText',
  'sourceType',
  'confidence',
];

export class InvalidCandidateEvidenceOutputError extends Error {
  constructor(message = 'The AI output does not match the candidate evidence schema.') {
    super(message);
    this.name = 'InvalidCandidateEvidenceOutputError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(record);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function isCategory(value: unknown): value is CandidateEvidenceCategory {
  return (
    typeof value === 'string' &&
    CANDIDATE_EVIDENCE_CATEGORIES.some((category) => category === value)
  );
}

function isEvidenceLevel(value: unknown): value is CandidateEvidenceLevel {
  return typeof value === 'string' && CANDIDATE_EVIDENCE_LEVELS.some((level) => level === value);
}

function isSourceType(value: unknown): value is CandidateEvidenceSourceType {
  return (
    typeof value === 'string' &&
    CANDIDATE_EVIDENCE_SOURCE_TYPES.some((sourceType) => sourceType === value)
  );
}

function parseEvidence(value: unknown, index: number): CandidateEvidence {
  if (!isRecord(value) || !hasExactKeys(value, EVIDENCE_KEYS)) {
    throw new InvalidCandidateEvidenceOutputError(`Evidence ${index} has invalid fields.`);
  }

  const { category, confidence, evidenceLevel, evidenceText, skill, sourceType, years } = value;
  if (typeof skill !== 'string' || !skill.trim()) {
    throw new InvalidCandidateEvidenceOutputError(`Evidence ${index} has an invalid skill.`);
  }
  if (!isCategory(category) || !isEvidenceLevel(evidenceLevel) || !isSourceType(sourceType)) {
    throw new InvalidCandidateEvidenceOutputError(`Evidence ${index} has invalid enums.`);
  }
  if (years !== null && (typeof years !== 'number' || !Number.isFinite(years) || years < 0)) {
    throw new InvalidCandidateEvidenceOutputError(`Evidence ${index} has invalid years.`);
  }
  if (typeof evidenceText !== 'string' || !evidenceText.trim()) {
    throw new InvalidCandidateEvidenceOutputError(`Evidence ${index} has invalid source text.`);
  }
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new InvalidCandidateEvidenceOutputError(`Evidence ${index} has invalid confidence.`);
  }
  if (sourceType === 'skills_section' && (evidenceLevel !== 'weak' || years !== null)) {
    throw new InvalidCandidateEvidenceOutputError(
      `Evidence ${index} from a skills section must be weak and cannot claim years.`,
    );
  }

  return {
    category,
    confidence,
    evidenceLevel,
    evidenceText: evidenceText.trim(),
    skill: skill.trim(),
    sourceType,
    years,
  };
}

export function validateCandidateEvidencePayload(payload: unknown): ExtractedCandidateEvidence {
  if (!isRecord(payload) || !hasExactKeys(payload, ROOT_KEYS) || !Array.isArray(payload.evidence)) {
    throw new InvalidCandidateEvidenceOutputError();
  }

  return { evidence: payload.evidence.map((item, index) => parseEvidence(item, index)) };
}

export function parseCandidateEvidenceJson(content: string): ExtractedCandidateEvidence {
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    throw new InvalidCandidateEvidenceOutputError('The AI output is not valid JSON.');
  }
  return validateCandidateEvidencePayload(payload);
}

function normalizeSourceText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function assertCandidateEvidenceIsGrounded(
  output: ExtractedCandidateEvidence,
  cvText: string,
): void {
  const normalizedCv = normalizeSourceText(cvText);
  for (const evidence of output.evidence) {
    if (!normalizedCv.includes(normalizeSourceText(evidence.evidenceText))) {
      throw new InvalidCandidateEvidenceOutputError(
        `Evidence for "${evidence.skill}" is not present in the source CV.`,
      );
    }
  }
}
