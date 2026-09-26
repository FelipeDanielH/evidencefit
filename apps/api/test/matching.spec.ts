import type { CandidateEvidence } from '../src/ai/candidate-evidence.types.js';
import type { JobRequirement } from '../src/ai/job-requirements.types.js';
import type { RequirementMatch } from '../src/evaluations/evaluation.types.js';
import { MatchingService, normalizeSkillName } from '../src/evaluations/matching.service.js';

function requirement(overrides: Partial<JobRequirement> = {}): JobRequirement {
  return {
    category: 'technology',
    evidenceText: 'NestJS',
    level: 'unknown',
    name: 'NestJS',
    required: true,
    years: null,
    ...overrides,
  };
}

function evidence(overrides: Partial<CandidateEvidence> = {}): CandidateEvidence {
  return {
    category: 'technology',
    confidence: 0.82,
    evidenceLevel: 'strong',
    evidenceText: 'Desarrollé servicios con NestJS',
    skill: 'NestJS',
    sourceType: 'professional_experience',
    years: null,
    ...overrides,
  };
}

function scoreMatch(
  status: RequirementMatch['status'],
  required: boolean | null,
): RequirementMatch {
  return {
    confidence: 1,
    explanation: 'Test',
    matchedEvidence: [],
    missingInformation: [],
    requirement: {
      category: 'technology',
      level: 'unknown',
      name: 'Test',
      required,
      years: null,
    },
    status,
  };
}

describe('MatchingService', () => {
  const service = new MatchingService();

  it('matches the exact normalized skill', () => {
    const result = service.evaluate([requirement()], [evidence()]);

    expect(result.matches[0]).toMatchObject({
      status: 'strong',
      confidence: 0.82,
    });
  });

  it('normalizes safe typographic variants without semantic aliases', () => {
    expect(normalizeSkillName('Node.js')).toBe('nodejs');
    expect(normalizeSkillName('nodejs')).toBe('nodejs');

    const result = service.evaluate(
      [requirement({ name: 'Node.js' })],
      [evidence({ skill: 'nodejs', evidenceText: 'Skills: nodejs' })],
    );
    expect(result.matches[0]?.status).toBe('strong');
    expect(normalizeSkillName('JavaScript')).not.toBe(normalizeSkillName('TypeScript'));
  });

  it('keeps a skills-section mention weak', () => {
    const result = service.evaluate(
      [requirement({ years: 2 })],
      [
        evidence({
          evidenceLevel: 'weak',
          evidenceText: 'Skills: NestJS',
          sourceType: 'skills_section',
        }),
      ],
    );

    expect(result.matches[0]?.status).toBe('weak');
    expect(result.matches[0]?.missingInformation).toContain(
      'No existe evidencia suficiente para acreditar 2 años de experiencia.',
    );
  });

  it('does not treat unverifiable years as not found', () => {
    const result = service.evaluate(
      [requirement({ years: 2 })],
      [evidence({ evidenceLevel: 'medium', sourceType: 'project' })],
    );

    expect(result.matches[0]?.status).toBe('medium');
    expect(result.matches[0]?.matchedEvidence).toHaveLength(1);
  });

  it('returns not_found only when no normalized skill matches', () => {
    const result = service.evaluate([requirement()], [evidence({ skill: 'Fastify' })]);

    expect(result.matches[0]).toMatchObject({
      status: 'not_found',
      matchedEvidence: [],
    });
  });

  it('returns unknown for related but inconclusive evidence', () => {
    const result = service.evaluate(
      [requirement()],
      [evidence({ evidenceLevel: 'unknown', sourceType: 'unknown' })],
    );

    expect(result.matches[0]?.status).toBe('unknown');
    expect(result.matches[0]?.missingInformation).toContain(
      'La evidencia relacionada tiene un nivel desconocido.',
    );
  });

  it('weights mandatory requirements more than desirable ones', () => {
    const requiredStrong = service.calculateScore([
      scoreMatch('strong', true),
      scoreMatch('not_found', false),
    ]);
    const desirableStrong = service.calculateScore([
      scoreMatch('strong', false),
      scoreMatch('not_found', true),
    ]);

    expect(requiredStrong).toBe(0.6667);
    expect(desirableStrong).toBe(0.3333);
  });

  it('uses the documented status values and returns null without requirements', () => {
    expect(
      service.calculateScore([
        scoreMatch('strong', null),
        scoreMatch('medium', null),
        scoreMatch('weak', null),
        scoreMatch('unknown', null),
        scoreMatch('not_found', null),
      ]),
    ).toBe(0.46);
    expect(service.calculateScore([])).toBeNull();
  });
});
