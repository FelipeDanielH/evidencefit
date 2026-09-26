import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { OpenRouterProvider } from '../src/ai/providers/openrouter.provider.js';

const validCandidateOutput = JSON.stringify({
  evidence: [
    {
      category: 'technology',
      confidence: 0.9,
      evidenceLevel: 'weak',
      evidenceText: 'Skills: NestJS',
      skill: 'NestJS',
      sourceType: 'skills_section',
      years: null,
    },
  ],
});

function createProvider(overrides: Record<string, string> = {}): OpenRouterProvider {
  return new OpenRouterProvider(
    new ConfigService({
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_MODEL: 'openrouter/free',
      OPENROUTER_TIMEOUT_MS: '100',
      ...overrides,
    }),
  );
}

function completionResponse(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }], model: 'synthetic/free' }),
    { headers: { 'content-type': 'application/json' }, status },
  );
}

describe('OpenRouterProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts the official free router and sends a strict JSON schema', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(completionResponse(validCandidateOutput));
    const provider = createProvider();

    await expect(provider.extractCandidateEvidence('Skills: NestJS')).resolves.toMatchObject({
      evidence: [{ evidenceLevel: 'weak', sourceType: 'skills_section', years: null }],
    });
    expect(provider.isConfigured()).toBe(true);

    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(request.body) as unknown;
    expect(body).toMatchObject({
      model: 'openrouter/free',
      provider: { require_parameters: true },
      response_format: {
        json_schema: { name: 'candidate_evidence', strict: true },
        type: 'json_schema',
      },
    });
  });

  it('rejects invalid structured output without exposing provider details', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(completionResponse('{"evidence":[{"category":"invalid"}]}'));

    await expect(createProvider().extractCandidateEvidence('Skills: NestJS')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('handles rate limiting as a controlled service error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(completionResponse('{}', 429));

    await expect(createProvider().extractCandidateEvidence('Skills: NestJS')).rejects.toThrow(
      'OpenRouter rate limit reached.',
    );
  });

  it('handles an unavailable provider as a controlled service error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(completionResponse('{}', 503));

    await expect(createProvider().extractCandidateEvidence('Skills: NestJS')).rejects.toThrow(
      'OpenRouter is temporarily unavailable.',
    );
  });

  it('aborts requests after the configured timeout', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    await expect(
      createProvider({ OPENROUTER_TIMEOUT_MS: '1' }).extractCandidateEvidence('Skills: NestJS'),
    ).rejects.toThrow('OpenRouter request timed out.');
  });

  it('rejects missing credentials before making a request', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      createProvider({ OPENROUTER_API_KEY: '' }).extractCandidateEvidence('Skills: NestJS'),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
