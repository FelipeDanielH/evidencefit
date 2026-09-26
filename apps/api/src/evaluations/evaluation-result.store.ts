import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { MatchedEvidence, RequirementMatch } from './evaluation.types.js';
import {
  EvaluationResultEntity,
  type EvaluationResultDocument,
} from './schemas/evaluation-result.schema.js';

export interface StoredEvaluationResult {
  candidateId: string;
  evaluatedAt: string;
  evaluationId: string;
  jobId: string;
  matches: RequirementMatch[];
  score: number | null;
}

@Injectable()
export class EvaluationResultStore {
  constructor(
    @Optional()
    @InjectModel(EvaluationResultEntity.name)
    private readonly resultModel?: Model<EvaluationResultEntity>,
  ) {}

  async findByEvaluationId(evaluationId: string): Promise<StoredEvaluationResult | null> {
    if (!this.resultModel) return null;

    try {
      const document = await this.resultModel.findOne({ evaluationId }).exec();
      return document ? this.toStoredResult(document) : null;
    } catch {
      throw new ServiceUnavailableException('Evaluation result storage is unavailable.');
    }
  }

  async findByEvaluationIds(evaluationIds: string[]): Promise<StoredEvaluationResult[]> {
    if (!this.resultModel) return [];

    try {
      const documents = await this.resultModel
        .find({ evaluationId: { $in: evaluationIds } })
        .exec();
      return documents.map((document) => this.toStoredResult(document));
    } catch {
      throw new ServiceUnavailableException('Evaluation result storage is unavailable.');
    }
  }

  async upsert(result: StoredEvaluationResult): Promise<StoredEvaluationResult> {
    if (!this.resultModel) {
      throw new ServiceUnavailableException('MongoDB is not configured.');
    }

    try {
      await this.resultModel
        .updateOne(
          { evaluationId: result.evaluationId },
          {
            $set: {
              candidateId: result.candidateId,
              evaluatedAt: new Date(result.evaluatedAt),
              jobId: result.jobId,
              matches: result.matches,
              score: result.score,
            },
          },
          { upsert: true },
        )
        .exec();
      return result;
    } catch {
      throw new ServiceUnavailableException('Evaluation result storage is unavailable.');
    }
  }

  private toStoredResult(document: EvaluationResultDocument): StoredEvaluationResult {
    const matches: RequirementMatch[] = document.matches.map((match) => {
      const matchedEvidence: MatchedEvidence[] = match.matchedEvidence.map((evidence) => ({
        category: evidence.category,
        confidence: evidence.confidence,
        evidenceLevel: evidence.evidenceLevel,
        sourceType: evidence.sourceType,
        text: evidence.text,
        years: evidence.years,
      }));
      return {
        confidence: match.confidence,
        explanation: match.explanation,
        matchedEvidence,
        missingInformation: [...match.missingInformation],
        requirement: {
          category: match.requirement.category,
          level: match.requirement.level,
          name: match.requirement.name,
          required: match.requirement.required,
          years: match.requirement.years,
        },
        status: match.status,
      };
    });

    return {
      candidateId: document.candidateId,
      evaluatedAt: document.evaluatedAt.toISOString(),
      evaluationId: document.evaluationId,
      jobId: document.jobId,
      matches,
      score: document.score,
    };
  }
}
