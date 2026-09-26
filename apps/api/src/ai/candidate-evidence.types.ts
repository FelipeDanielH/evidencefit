export const CANDIDATE_EVIDENCE_CATEGORIES = [
  'technology',
  'skill',
  'experience',
  'education',
  'language',
  'other',
  'unknown',
] as const;

export const CANDIDATE_EVIDENCE_LEVELS = ['strong', 'medium', 'weak', 'unknown'] as const;

export const CANDIDATE_EVIDENCE_SOURCE_TYPES = [
  'professional_experience',
  'project',
  'education',
  'skills_section',
  'other',
  'unknown',
] as const;

export type CandidateEvidenceCategory = (typeof CANDIDATE_EVIDENCE_CATEGORIES)[number];
export type CandidateEvidenceLevel = (typeof CANDIDATE_EVIDENCE_LEVELS)[number];
export type CandidateEvidenceSourceType = (typeof CANDIDATE_EVIDENCE_SOURCE_TYPES)[number];

export interface CandidateEvidence {
  category: CandidateEvidenceCategory;
  confidence: number;
  evidenceLevel: CandidateEvidenceLevel;
  evidenceText: string;
  skill: string;
  sourceType: CandidateEvidenceSourceType;
  years: number | null;
}

export interface ExtractedCandidateEvidence {
  evidence: CandidateEvidence[];
}

export const CANDIDATE_EVIDENCE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          skill: { type: 'string', minLength: 1 },
          category: { type: 'string', enum: CANDIDATE_EVIDENCE_CATEGORIES },
          evidenceLevel: { type: 'string', enum: CANDIDATE_EVIDENCE_LEVELS },
          years: { type: ['number', 'null'], minimum: 0 },
          evidenceText: { type: 'string', minLength: 1 },
          sourceType: { type: 'string', enum: CANDIDATE_EVIDENCE_SOURCE_TYPES },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'skill',
          'category',
          'evidenceLevel',
          'years',
          'evidenceText',
          'sourceType',
          'confidence',
        ],
      },
    },
  },
  required: ['evidence'],
} as const;
