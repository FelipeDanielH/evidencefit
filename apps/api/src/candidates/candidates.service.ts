import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_PROVIDER, type AiProvider } from '../ai/ai-provider.js';
import {
  InvalidCandidateEvidenceOutputError,
  assertCandidateEvidenceIsGrounded,
  validateCandidateEvidencePayload,
} from '../ai/candidate-evidence.parser.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Candidate } from '../generated/prisma/client.js';
import {
  CandidateEvidenceStore,
  type StoredCandidateEvidence,
} from './candidate-evidence.store.js';
import type { CreateCandidateDto } from './dto/create-candidate.dto.js';

export interface CandidateDetail extends Candidate {
  evidenceExtraction: StoredCandidateEvidence | null;
}

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly evidenceStore: CandidateEvidenceStore,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  async create(input: CreateCandidateDto): Promise<Candidate> {
    try {
      return await this.prismaService.client.candidate.create({
        data: {
          cvText: input.cvText.trim(),
          name: input.name.trim(),
        },
      });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Candidate storage is unavailable.');
    }
  }

  async findAll(): Promise<Candidate[]> {
    try {
      return await this.prismaService.client.candidate.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Candidate storage is unavailable.');
    }
  }

  async findOne(id: string): Promise<CandidateDetail> {
    const candidate = await this.findCandidateOrThrow(id);
    const evidenceExtraction = await this.evidenceStore.findByCandidateId(id);
    return { ...candidate, evidenceExtraction };
  }

  async extractEvidence(id: string): Promise<StoredCandidateEvidence> {
    const candidate = await this.findCandidateOrThrow(id);

    try {
      const providerOutput = await this.aiProvider.extractCandidateEvidence(candidate.cvText);
      const output = validateCandidateEvidencePayload(providerOutput);
      assertCandidateEvidenceIsGrounded(output, candidate.cvText);
      return await this.evidenceStore.upsert({
        candidateId: candidate.id,
        evidence: output.evidence,
        extractedAt: new Date().toISOString(),
        provider: this.aiProvider.name,
      });
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      if (error instanceof InvalidCandidateEvidenceOutputError) {
        throw new BadGatewayException('The AI provider returned invalid candidate evidence.');
      }
      throw new ServiceUnavailableException('Candidate evidence could not be extracted.');
    }
  }

  private async findCandidateOrThrow(id: string): Promise<Candidate> {
    let candidate: Candidate | null;
    try {
      candidate = await this.prismaService.client.candidate.findUnique({ where: { id } });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Candidate storage is unavailable.');
    }

    if (!candidate) {
      throw new NotFoundException('Candidate not found.');
    }
    return candidate;
  }
}
