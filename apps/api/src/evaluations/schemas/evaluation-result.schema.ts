import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import {
  CANDIDATE_EVIDENCE_CATEGORIES,
  CANDIDATE_EVIDENCE_LEVELS,
  CANDIDATE_EVIDENCE_SOURCE_TYPES,
  type CandidateEvidenceCategory,
  type CandidateEvidenceLevel,
  type CandidateEvidenceSourceType,
} from '../../ai/candidate-evidence.types.js';
import {
  JOB_REQUIREMENT_CATEGORIES,
  JOB_REQUIREMENT_LEVELS,
  type JobRequirementCategory,
  type JobRequirementLevel,
} from '../../ai/job-requirements.types.js';
import { MATCH_STATUSES, type MatchStatus } from '../evaluation.types.js';

@Schema({ _id: false })
export class EvaluationRequirementRecord {
  @Prop({ required: true, type: String, enum: JOB_REQUIREMENT_CATEGORIES })
  category!: JobRequirementCategory;

  @Prop({ required: true, type: String, enum: JOB_REQUIREMENT_LEVELS })
  level!: JobRequirementLevel;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: false, type: Boolean, default: null })
  required!: boolean | null;

  @Prop({ required: false, type: Number, default: null, min: 0 })
  years!: number | null;
}

export const EvaluationRequirementSchema = SchemaFactory.createForClass(
  EvaluationRequirementRecord,
);

@Schema({ _id: false })
export class MatchedEvidenceRecord {
  @Prop({ required: true, type: String, enum: CANDIDATE_EVIDENCE_CATEGORIES })
  category!: CandidateEvidenceCategory;

  @Prop({ required: true, type: Number, min: 0, max: 1 })
  confidence!: number;

  @Prop({ required: true, type: String, enum: CANDIDATE_EVIDENCE_LEVELS })
  evidenceLevel!: CandidateEvidenceLevel;

  @Prop({ required: true, type: String, enum: CANDIDATE_EVIDENCE_SOURCE_TYPES })
  sourceType!: CandidateEvidenceSourceType;

  @Prop({ required: true, trim: true })
  text!: string;

  @Prop({ required: false, type: Number, default: null, min: 0 })
  years!: number | null;
}

export const MatchedEvidenceSchema = SchemaFactory.createForClass(MatchedEvidenceRecord);

@Schema({ _id: false })
export class RequirementMatchRecord {
  @Prop({ required: true, type: Number, min: 0, max: 1 })
  confidence!: number;

  @Prop({ required: true, trim: true })
  explanation!: string;

  @Prop({ required: true, type: [MatchedEvidenceSchema], default: [] })
  matchedEvidence!: MatchedEvidenceRecord[];

  @Prop({ required: true, type: [String], default: [] })
  missingInformation!: string[];

  @Prop({ required: true, type: EvaluationRequirementSchema })
  requirement!: EvaluationRequirementRecord;

  @Prop({ required: true, type: String, enum: MATCH_STATUSES })
  status!: MatchStatus;
}

export const RequirementMatchSchema = SchemaFactory.createForClass(RequirementMatchRecord);

@Schema({ collection: 'evaluation_results', timestamps: true, versionKey: false })
export class EvaluationResultEntity {
  @Prop({ required: true, unique: true, index: true })
  evaluationId!: string;

  @Prop({ required: true, index: true })
  jobId!: string;

  @Prop({ required: true, index: true })
  candidateId!: string;

  @Prop({ required: false, type: Number, default: null, min: 0, max: 1 })
  score!: number | null;

  @Prop({ required: true, type: [RequirementMatchSchema], default: [] })
  matches!: RequirementMatchRecord[];

  @Prop({ required: true, type: Date })
  evaluatedAt!: Date;
}

export type EvaluationResultDocument = HydratedDocument<EvaluationResultEntity>;

export const EvaluationResultSchema = SchemaFactory.createForClass(EvaluationResultEntity);
