import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Evaluation, Job } from '../generated/prisma/client.js';
import { EvaluationResultStore, type StoredEvaluationResult } from './evaluation-result.store.js';
import type { RequirementMatch } from './evaluation.types.js';
import type {
  CandidateRequirementComparison,
  ComparedRequirement,
  ComparisonCandidate,
  ComparisonEvaluationOption,
  ComparisonSelection,
  JobComparison,
} from './comparison.types.js';

interface EvaluationWithCandidate extends Evaluation {
  candidate: {
    id: string;
    name: string;
  };
}

function requirementKey(match: RequirementMatch): string {
  const { category, level, name, required, years } = match.requirement;
  return JSON.stringify([name, category, level, required, years]);
}

function toCandidateResult(
  evaluationId: string,
  candidateId: string,
  match: RequirementMatch,
): CandidateRequirementComparison {
  const required = match.requirement.required === true;
  return {
    candidateId,
    confidence: match.confidence,
    evaluationId,
    evidence: match.matchedEvidence,
    explanation: match.explanation,
    hasRequiredGap: required && match.status !== 'strong' && match.status !== 'unknown',
    isStrength: match.status === 'strong',
    isUnknown: match.status === 'unknown',
    missingInformation: match.missingInformation,
    status: match.status,
  };
}

@Injectable()
export class ComparisonService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly evaluationResultStore: EvaluationResultStore,
  ) {}

  async listEvaluations(jobId: string): Promise<ComparisonSelection> {
    const job = await this.findJobOrThrow(jobId);
    let evaluations: EvaluationWithCandidate[];
    try {
      evaluations = await this.prismaService.client.evaluation.findMany({
        where: { jobId },
        include: { candidate: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      throw new ServiceUnavailableException('Evaluation storage is unavailable.');
    }

    const options: ComparisonEvaluationOption[] = evaluations.map((evaluation) => ({
      candidateId: evaluation.candidateId,
      candidateName: evaluation.candidate.name,
      createdAt: evaluation.createdAt.toISOString(),
      evaluationId: evaluation.id,
      score: evaluation.score,
    }));
    return { evaluations: options, job: { id: job.id, title: job.title } };
  }

  async compare(jobId: string, requestedIds: string[]): Promise<JobComparison> {
    const job = await this.findJobOrThrow(jobId);
    const evaluationIds = requestedIds.map((id) => id.trim()).filter(Boolean);
    if (evaluationIds.length < 2) {
      throw new BadRequestException('At least two evaluationIds are required.');
    }
    if (new Set(evaluationIds).size !== evaluationIds.length) {
      throw new BadRequestException('evaluationIds must be distinct.');
    }

    const evaluations = await this.findEvaluations(evaluationIds);
    if (evaluations.length !== evaluationIds.length) {
      throw new NotFoundException('One or more evaluations were not found.');
    }
    if (evaluations.some((evaluation) => evaluation.jobId !== job.id)) {
      throw new BadRequestException('All evaluations must belong to the requested job.');
    }

    const evaluationMap = new Map(evaluations.map((evaluation) => [evaluation.id, evaluation]));
    const orderedEvaluations = evaluationIds.map((id) => {
      const evaluation = evaluationMap.get(id);
      if (!evaluation) {
        throw new NotFoundException('One or more evaluations were not found.');
      }
      return evaluation;
    });
    const storedResults = await this.evaluationResultStore.findByEvaluationIds(evaluationIds);
    const resultMap = new Map(storedResults.map((result) => [result.evaluationId, result]));

    for (const evaluation of orderedEvaluations) {
      const result = resultMap.get(evaluation.id);
      if (!result) {
        throw new NotFoundException(
          `Evaluation result was not found for evaluation ${evaluation.id}.`,
        );
      }
      if (result.jobId !== job.id || result.candidateId !== evaluation.candidateId) {
        throw new ServiceUnavailableException('Evaluation result data is inconsistent.');
      }
    }

    const candidates = this.buildCandidates(orderedEvaluations);
    return {
      candidates,
      job: { id: job.id, title: job.title },
      requirements: this.buildRequirements(orderedEvaluations, resultMap, candidates),
    };
  }

  private async findJobOrThrow(jobId: string): Promise<Job> {
    let job: Job | null;
    try {
      job = await this.prismaService.client.job.findUnique({ where: { id: jobId } });
    } catch {
      throw new ServiceUnavailableException('Job storage is unavailable.');
    }
    if (!job) throw new NotFoundException('Job not found.');
    return job;
  }

  private async findEvaluations(ids: string[]): Promise<EvaluationWithCandidate[]> {
    try {
      return await this.prismaService.client.evaluation.findMany({
        where: { id: { in: ids } },
        include: { candidate: { select: { id: true, name: true } } },
      });
    } catch {
      throw new ServiceUnavailableException('Evaluation storage is unavailable.');
    }
  }

  private buildCandidates(evaluations: EvaluationWithCandidate[]): ComparisonCandidate[] {
    const inputOrder = new Map(evaluations.map((evaluation, index) => [evaluation.id, index]));
    const scoreCounts = new Map<number, number>();
    for (const evaluation of evaluations) {
      if (evaluation.score !== null) {
        scoreCounts.set(evaluation.score, (scoreCounts.get(evaluation.score) ?? 0) + 1);
      }
    }

    return evaluations
      .map((evaluation) => ({
        candidateId: evaluation.candidateId,
        evaluationId: evaluation.id,
        name: evaluation.candidate.name,
        score: evaluation.score,
        scoreTied: evaluation.score !== null && (scoreCounts.get(evaluation.score) ?? 0) > 1,
      }))
      .sort((left, right) => {
        const leftScore = left.score ?? Number.NEGATIVE_INFINITY;
        const rightScore = right.score ?? Number.NEGATIVE_INFINITY;
        if (leftScore !== rightScore) return rightScore - leftScore;
        return (inputOrder.get(left.evaluationId) ?? 0) - (inputOrder.get(right.evaluationId) ?? 0);
      });
  }

  private buildRequirements(
    evaluations: EvaluationWithCandidate[],
    resultMap: Map<string, StoredEvaluationResult>,
    candidates: ComparisonCandidate[],
  ): ComparedRequirement[] {
    const requirements = new Map<string, ComparedRequirement>();
    for (const evaluation of evaluations) {
      const storedResult = resultMap.get(evaluation.id);
      if (!storedResult) continue;
      for (const match of storedResult.matches) {
        const key = requirementKey(match);
        const existing = requirements.get(key);
        const candidateResult = toCandidateResult(evaluation.id, evaluation.candidateId, match);
        if (existing) {
          existing.results.push(candidateResult);
        } else {
          requirements.set(key, {
            category: match.requirement.category,
            level: match.requirement.level,
            name: match.requirement.name,
            required: match.requirement.required,
            results: [candidateResult],
            years: match.requirement.years,
          });
        }
      }
    }

    const candidateOrder = new Map(
      candidates.map((candidate, index) => [candidate.evaluationId, index]),
    );
    for (const requirement of requirements.values()) {
      requirement.results.sort(
        (left, right) =>
          (candidateOrder.get(left.evaluationId) ?? 0) -
          (candidateOrder.get(right.evaluationId) ?? 0),
      );
    }
    return [...requirements.values()];
  }
}
