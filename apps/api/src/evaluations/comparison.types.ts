import type { MatchedEvidence, MatchStatus } from './evaluation.types.js';
import type { JobRequirementCategory, JobRequirementLevel } from '../ai/job-requirements.types.js';

export interface ComparisonJob {
  id: string;
  title: string;
}

export interface ComparisonEvaluationOption {
  candidateId: string;
  candidateName: string;
  createdAt: string;
  evaluationId: string;
  score: number | null;
}

export interface ComparisonSelection {
  evaluations: ComparisonEvaluationOption[];
  job: ComparisonJob;
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
  job: ComparisonJob;
  requirements: ComparedRequirement[];
}
