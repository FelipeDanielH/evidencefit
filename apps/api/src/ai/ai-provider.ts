import type { ExtractedJobRequirements, JobRequirementsInput } from './job-requirements.types.js';
import type { ExtractedCandidateEvidence } from './candidate-evidence.types.js';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  readonly name: string;
  extractCandidateEvidence(input: string): Promise<ExtractedCandidateEvidence>;
  extractJobRequirements(input: JobRequirementsInput): Promise<ExtractedJobRequirements>;
  isConfigured(): boolean;
}
