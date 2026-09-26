import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type {
  CandidateEvidence,
  ExtractedCandidateEvidence,
} from '../ai/candidate-evidence.types.js';
import {
  CandidateEvidenceExtractionEntity,
  type CandidateEvidenceExtractionDocument,
} from './schemas/candidate-evidence.schema.js';

export interface StoredCandidateEvidence extends ExtractedCandidateEvidence {
  candidateId: string;
  extractedAt: string;
  provider: string;
}

@Injectable()
export class CandidateEvidenceStore {
  constructor(
    @Optional()
    @InjectModel(CandidateEvidenceExtractionEntity.name)
    private readonly extractionModel?: Model<CandidateEvidenceExtractionEntity>,
  ) {}

  async findByCandidateId(candidateId: string): Promise<StoredCandidateEvidence | null> {
    if (!this.extractionModel) {
      return null;
    }

    try {
      const document = await this.extractionModel.findOne({ candidateId }).exec();
      return document ? this.toStoredEvidence(document) : null;
    } catch {
      throw new ServiceUnavailableException('Candidate evidence storage is unavailable.');
    }
  }

  async upsert(extraction: StoredCandidateEvidence): Promise<StoredCandidateEvidence> {
    if (!this.extractionModel) {
      throw new ServiceUnavailableException('MongoDB is not configured.');
    }

    try {
      await this.extractionModel
        .updateOne(
          { candidateId: extraction.candidateId },
          {
            $set: {
              evidence: extraction.evidence,
              extractedAt: new Date(extraction.extractedAt),
              provider: extraction.provider,
            },
          },
          { upsert: true },
        )
        .exec();
      return extraction;
    } catch {
      throw new ServiceUnavailableException('Candidate evidence storage is unavailable.');
    }
  }

  private toStoredEvidence(document: CandidateEvidenceExtractionDocument): StoredCandidateEvidence {
    const evidence: CandidateEvidence[] = document.evidence.map((item) => ({
      category: item.category,
      confidence: item.confidence,
      evidenceLevel: item.evidenceLevel,
      evidenceText: item.evidenceText,
      skill: item.skill,
      sourceType: item.sourceType,
      years: item.years,
    }));

    return {
      candidateId: document.candidateId,
      evidence,
      extractedAt: document.extractedAt.toISOString(),
      provider: document.provider,
    };
  }
}
