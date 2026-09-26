import type {
  CandidateEvidenceCategory,
  CandidateEvidenceLevel,
  CandidateEvidenceSourceType,
} from '../ai/candidate-evidence.types.js';
import type { JobRequirementCategory, JobRequirementLevel } from '../ai/job-requirements.types.js';

export const MATCH_STATUSES = ['strong', 'medium', 'weak', 'unknown', 'not_found'] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

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
  matches: RequirementMatch[];
  score: number | null;
}
