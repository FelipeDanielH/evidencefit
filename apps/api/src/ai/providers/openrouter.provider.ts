import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider } from '../ai-provider.js';
import {
  InvalidCandidateEvidenceOutputError,
  assertCandidateEvidenceIsGrounded,
  parseCandidateEvidenceJson,
} from '../candidate-evidence.parser.js';
import {
  CANDIDATE_EVIDENCE_JSON_SCHEMA,
  type ExtractedCandidateEvidence,
} from '../candidate-evidence.types.js';
import {
  InvalidJobRequirementsOutputError,
  assertRequirementsAreGrounded,
  parseJobRequirementsJson,
} from '../job-requirements.parser.js';
import {
  JOB_REQUIREMENTS_JSON_SCHEMA,
  type ExtractedJobRequirements,
  type JobRequirementsInput,
} from '../job-requirements.types.js';
import { buildCandidateEvidenceMessages } from '../prompts/candidate-evidence.prompt.js';
import {
  buildJobRequirementsMessages,
  type AiMessage,
} from '../prompts/job-requirements.prompt.js';

const OPENROUTER_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

function isFreeModel(model: string | undefined): model is string {
  return model === 'openrouter/free' || model?.endsWith(':free') === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface OpenRouterMessage {
  content: string;
  model: string | null;
}

function extractMessage(payload: unknown): OpenRouterMessage | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const firstChoice: unknown = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  return typeof firstChoice.message.content === 'string'
    ? {
        content: firstChoice.message.content,
        model: typeof payload.model === 'string' ? payload.model : null,
      }
    : null;
}

@Injectable()
export class OpenRouterProvider implements AiProvider {
  readonly name = 'openrouter';
  private readonly logger = new Logger(OpenRouterProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const model = this.configService.get<string>('OPENROUTER_MODEL');
    return Boolean(this.configService.get<string>('OPENROUTER_API_KEY') && isFreeModel(model));
  }

  async extractCandidateEvidence(input: string): Promise<ExtractedCandidateEvidence> {
    if (!input.trim()) {
      throw new BadRequestException('Candidate CV cannot be empty.');
    }

    try {
      const content = await this.requestStructuredOutput(
        buildCandidateEvidenceMessages(input),
        'candidate_evidence',
        CANDIDATE_EVIDENCE_JSON_SCHEMA,
      );
      const output = parseCandidateEvidenceJson(content);
      assertCandidateEvidenceIsGrounded(output, input);
      return output;
    } catch (error: unknown) {
      if (error instanceof InvalidCandidateEvidenceOutputError) {
        throw new BadGatewayException('OpenRouter returned invalid candidate evidence.');
      }
      throw error;
    }
  }

  async extractJobRequirements(input: JobRequirementsInput): Promise<ExtractedJobRequirements> {
    if (!input.title.trim() || !input.description.trim()) {
      throw new BadRequestException('Job title and description cannot be empty.');
    }

    try {
      const content = await this.requestStructuredOutput(
        buildJobRequirementsMessages(input),
        'job_requirements',
        JOB_REQUIREMENTS_JSON_SCHEMA,
      );
      const output = parseJobRequirementsJson(content);
      assertRequirementsAreGrounded(output, input.description);
      return output;
    } catch (error: unknown) {
      if (error instanceof InvalidJobRequirementsOutputError) {
        throw new BadGatewayException('OpenRouter returned invalid job requirements.');
      }
      throw error;
    }
  }

  private async requestStructuredOutput(
    messages: AiMessage[],
    schemaName: string,
    schema: unknown,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const model = this.configService.get<string>('OPENROUTER_MODEL');
    if (!apiKey || !isFreeModel(model)) {
      throw new ServiceUnavailableException('OpenRouter is not configured.');
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.getTimeoutMs());

    try {
      const response = await fetch(OPENROUTER_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema },
          },
          provider: { require_parameters: true },
        }),
        signal: abortController.signal,
      });

      if (response.status === 429) {
        throw new ServiceUnavailableException('OpenRouter rate limit reached.');
      }
      if ([502, 503, 504].includes(response.status)) {
        throw new ServiceUnavailableException('OpenRouter is temporarily unavailable.');
      }
      if (!response.ok) {
        throw new BadGatewayException('OpenRouter could not complete the extraction.');
      }

      const completion = extractMessage(await response.json());
      if (!completion) {
        throw new BadGatewayException('OpenRouter returned an invalid response.');
      }
      this.logger.log(`Structured output completed using ${completion.model ?? model}.`);
      return completion.content;
    } catch (error: unknown) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      if (isRecord(error) && error.name === 'AbortError') {
        throw new ServiceUnavailableException('OpenRouter request timed out.');
      }
      throw new ServiceUnavailableException('OpenRouter request could not be completed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private getTimeoutMs(): number {
    const configuredValue = Number(
      this.configService.get<string>('OPENROUTER_TIMEOUT_MS', '60000'),
    );
    return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 60000;
  }
}
