import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CandidateEvidenceStore } from '../candidates/candidate-evidence.store.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Candidate, Evaluation, Job } from '../generated/prisma/client.js';
import { JobRequirementsStore } from '../jobs/job-requirements.store.js';
import type { CreateEvaluationDto } from './dto/create-evaluation.dto.js';
import { EvaluationResultStore, type StoredEvaluationResult } from './evaluation-result.store.js';
import { MatchingService } from './matching.service.js';

export interface EvaluationDetail extends Evaluation {
  result: StoredEvaluationResult;
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobRequirementsStore: JobRequirementsStore,
    private readonly candidateEvidenceStore: CandidateEvidenceStore,
    private readonly evaluationResultStore: EvaluationResultStore,
    private readonly matchingService: MatchingService,
  ) {}

  async create(input: CreateEvaluationDto): Promise<EvaluationDetail> {
    const [job, candidate] = await this.findJobAndCandidate(input.jobId, input.candidateId);
    const [requirementsExtraction, evidenceExtraction] = await Promise.all([
      this.jobRequirementsStore.findByJobId(job.id),
      this.candidateEvidenceStore.findByCandidateId(candidate.id),
    ]);

    if (!requirementsExtraction) {
      throw new ConflictException('The job does not have a requirements extraction.');
    }
    if (!evidenceExtraction) {
      throw new ConflictException('The candidate does not have an evidence extraction.');
    }

    const matchingResult = this.matchingService.evaluate(
      requirementsExtraction.requirements,
      evidenceExtraction.evidence,
    );
    const evaluation = await this.createRelationalEvaluation(
      job.id,
      candidate.id,
      matchingResult.score,
    );
    const result: StoredEvaluationResult = {
      candidateId: candidate.id,
      evaluatedAt: new Date().toISOString(),
      evaluationId: evaluation.id,
      jobId: job.id,
      matches: matchingResult.matches,
      score: matchingResult.score,
    };

    try {
      await this.evaluationResultStore.upsert(result);
    } catch {
      await this.rollbackEvaluation(evaluation.id);
      throw new ServiceUnavailableException('Evaluation result could not be stored.');
    }

    return { ...evaluation, result };
  }

  async findOne(id: string): Promise<EvaluationDetail> {
    let evaluation: Evaluation | null;
    try {
      evaluation = await this.prismaService.client.evaluation.findUnique({ where: { id } });
    } catch {
      throw new ServiceUnavailableException('Evaluation storage is unavailable.');
    }
    if (!evaluation) throw new NotFoundException('Evaluation not found.');

    const result = await this.evaluationResultStore.findByEvaluationId(id);
    if (!result) {
      throw new ServiceUnavailableException('Evaluation result is unavailable.');
    }
    return { ...evaluation, result };
  }

  private async findJobAndCandidate(jobId: string, candidateId: string): Promise<[Job, Candidate]> {
    let job: Job | null;
    let candidate: Candidate | null;
    try {
      [job, candidate] = await Promise.all([
        this.prismaService.client.job.findUnique({ where: { id: jobId } }),
        this.prismaService.client.candidate.findUnique({ where: { id: candidateId } }),
      ]);
    } catch {
      throw new ServiceUnavailableException('Relational storage is unavailable.');
    }

    if (!job) throw new NotFoundException('Job not found.');
    if (!candidate) throw new NotFoundException('Candidate not found.');
    return [job, candidate];
  }

  private async createRelationalEvaluation(
    jobId: string,
    candidateId: string,
    score: number | null,
  ): Promise<Evaluation> {
    try {
      return await this.prismaService.client.evaluation.create({
        data: { candidateId, jobId, score },
      });
    } catch {
      throw new ServiceUnavailableException('Evaluation storage is unavailable.');
    }
  }

  private async rollbackEvaluation(id: string): Promise<void> {
    try {
      await this.prismaService.client.evaluation.delete({ where: { id } });
    } catch {
      // Preserve the original document-storage error; the orphan can be diagnosed by its null detail.
    }
  }
}
