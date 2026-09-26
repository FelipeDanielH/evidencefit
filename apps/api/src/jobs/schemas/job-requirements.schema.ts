import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import {
  JOB_REQUIREMENT_CATEGORIES,
  JOB_REQUIREMENT_LEVELS,
  type JobRequirementCategory,
  type JobRequirementLevel,
} from '../../ai/job-requirements.types.js';

@Schema({ _id: false })
export class JobRequirementRecord {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, type: String, enum: JOB_REQUIREMENT_CATEGORIES })
  category!: JobRequirementCategory;

  @Prop({ required: true, type: String, enum: JOB_REQUIREMENT_LEVELS })
  level!: JobRequirementLevel;

  @Prop({ required: false, type: Boolean, default: null })
  required!: boolean | null;

  @Prop({ required: false, type: Number, default: null, min: 0 })
  years!: number | null;

  @Prop({ required: true, trim: true })
  evidenceText!: string;
}

export const JobRequirementRecordSchema = SchemaFactory.createForClass(JobRequirementRecord);

@Schema({ collection: 'job_requirement_extractions', timestamps: true, versionKey: false })
export class JobRequirementsExtractionEntity {
  @Prop({ required: true, unique: true, index: true })
  jobId!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true, type: Date })
  extractedAt!: Date;

  @Prop({ required: true, type: [JobRequirementRecordSchema], default: [] })
  requirements!: JobRequirementRecord[];
}

export type JobRequirementsExtractionDocument = HydratedDocument<JobRequirementsExtractionEntity>;

export const JobRequirementsExtractionSchema = SchemaFactory.createForClass(
  JobRequirementsExtractionEntity,
);
