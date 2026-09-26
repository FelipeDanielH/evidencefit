import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { ExtractedJobRequirements, JobRequirement } from '../ai/job-requirements.types.js';
import {
  JobRequirementsExtractionEntity,
  type JobRequirementsExtractionDocument,
} from './schemas/job-requirements.schema.js';

export interface StoredJobRequirements extends ExtractedJobRequirements {
  extractedAt: string;
  jobId: string;
  provider: string;
}

@Injectable()
export class JobRequirementsStore {
  constructor(
    @Optional()
    @InjectModel(JobRequirementsExtractionEntity.name)
    private readonly extractionModel?: Model<JobRequirementsExtractionEntity>,
  ) {}

  async findByJobId(jobId: string): Promise<StoredJobRequirements | null> {
    if (!this.extractionModel) {
      return null;
    }

    try {
      const document = await this.extractionModel.findOne({ jobId }).exec();
      return document ? this.toStoredRequirements(document) : null;
    } catch {
      throw new ServiceUnavailableException('Requirements storage is unavailable.');
    }
  }

  async upsert(extraction: StoredJobRequirements): Promise<StoredJobRequirements> {
    if (!this.extractionModel) {
      throw new ServiceUnavailableException('MongoDB is not configured.');
    }

    try {
      await this.extractionModel
        .updateOne(
          { jobId: extraction.jobId },
          {
            $set: {
              extractedAt: new Date(extraction.extractedAt),
              provider: extraction.provider,
              requirements: extraction.requirements,
            },
          },
          { upsert: true },
        )
        .exec();
      return extraction;
    } catch {
      throw new ServiceUnavailableException('Requirements storage is unavailable.');
    }
  }

  private toStoredRequirements(document: JobRequirementsExtractionDocument): StoredJobRequirements {
    const requirements: JobRequirement[] = document.requirements.map((requirement) => ({
      category: requirement.category,
      evidenceText: requirement.evidenceText,
      level: requirement.level,
      name: requirement.name,
      required: requirement.required,
      years: requirement.years,
    }));

    return {
      extractedAt: document.extractedAt.toISOString(),
      jobId: document.jobId,
      provider: document.provider,
      requirements,
    };
  }
}
