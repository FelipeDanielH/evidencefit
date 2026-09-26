import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Job } from '../generated/prisma/client.js';
import { AI_PROVIDER, type AiProvider } from '../ai/ai-provider.js';
import { InvalidJobRequirementsOutputError } from '../ai/job-requirements.parser.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import { JobRequirementsStore, type StoredJobRequirements } from './job-requirements.store.js';

export interface JobDetail extends Job {
  requirementsExtraction: StoredJobRequirements | null;
}

@Injectable()
export class JobsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requirementsStore: JobRequirementsStore,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  async create(input: CreateJobDto): Promise<Job> {
    try {
      return await this.prismaService.client.job.create({
        data: {
          description: input.description.trim(),
          title: input.title.trim(),
        },
      });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Job storage is unavailable.');
    }
  }

  async findAll(): Promise<Job[]> {
    try {
      return await this.prismaService.client.job.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Job storage is unavailable.');
    }
  }

  async findOne(id: string): Promise<JobDetail> {
    const job = await this.findJobOrThrow(id);
    const requirementsExtraction = await this.requirementsStore.findByJobId(id);
    return { ...job, requirementsExtraction };
  }

  async extractRequirements(id: string): Promise<StoredJobRequirements> {
    const job = await this.findJobOrThrow(id);

    try {
      const output = await this.aiProvider.extractJobRequirements({
        description: job.description,
        title: job.title,
      });
      return await this.requirementsStore.upsert({
        extractedAt: new Date().toISOString(),
        jobId: job.id,
        provider: this.aiProvider.name,
        requirements: output.requirements,
      });
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      if (error instanceof InvalidJobRequirementsOutputError) {
        throw new BadGatewayException('The AI provider returned invalid job requirements.');
      }
      throw new ServiceUnavailableException('Job requirements could not be extracted.');
    }
  }

  private async findJobOrThrow(id: string): Promise<Job> {
    let job: Job | null;
    try {
      job = await this.prismaService.client.job.findUnique({ where: { id } });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Job storage is unavailable.');
    }

    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }
}
