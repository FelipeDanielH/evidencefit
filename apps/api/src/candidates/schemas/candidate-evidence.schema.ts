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

@Schema({ _id: false })
export class CandidateEvidenceRecord {
  @Prop({ required: true, trim: true })
  skill!: string;

  @Prop({ required: true, type: String, enum: CANDIDATE_EVIDENCE_CATEGORIES })
  category!: CandidateEvidenceCategory;

  @Prop({ required: true, type: String, enum: CANDIDATE_EVIDENCE_LEVELS })
  evidenceLevel!: CandidateEvidenceLevel;

  @Prop({ required: false, type: Number, default: null, min: 0 })
  years!: number | null;

  @Prop({ required: true, trim: true })
  evidenceText!: string;

  @Prop({ required: true, type: String, enum: CANDIDATE_EVIDENCE_SOURCE_TYPES })
  sourceType!: CandidateEvidenceSourceType;

  @Prop({ required: true, type: Number, min: 0, max: 1 })
  confidence!: number;
}

export const CandidateEvidenceRecordSchema = SchemaFactory.createForClass(CandidateEvidenceRecord);

@Schema({ collection: 'candidate_evidence_extractions', timestamps: true, versionKey: false })
export class CandidateEvidenceExtractionEntity {
  @Prop({ required: true, unique: true, index: true })
  candidateId!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true, type: Date })
  extractedAt!: Date;

  @Prop({ required: true, type: [CandidateEvidenceRecordSchema], default: [] })
  evidence!: CandidateEvidenceRecord[];
}

export type CandidateEvidenceExtractionDocument =
  HydratedDocument<CandidateEvidenceExtractionEntity>;

export const CandidateEvidenceExtractionSchema = SchemaFactory.createForClass(
  CandidateEvidenceExtractionEntity,
);
