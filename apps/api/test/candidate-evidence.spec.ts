import {
  InvalidCandidateEvidenceOutputError,
  assertCandidateEvidenceIsGrounded,
  parseCandidateEvidenceJson,
} from '../src/ai/candidate-evidence.parser.js';

function evidenceJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    evidence: [
      {
        skill: 'NestJS',
        category: 'technology',
        evidenceLevel: 'weak',
        years: null,
        evidenceText: 'Skills: NestJS',
        sourceType: 'skills_section',
        confidence: 0.78,
        ...overrides,
      },
    ],
  });
}

describe('candidate evidence output validation', () => {
  it('keeps a skills-section mention as weak evidence', () => {
    const output = parseCandidateEvidenceJson(evidenceJson());

    expect(output.evidence[0]).toMatchObject({
      evidenceLevel: 'weak',
      sourceType: 'skills_section',
      years: null,
    });
    expect(() => assertCandidateEvidenceIsGrounded(output, 'Skills: NestJS')).not.toThrow();
  });

  it('accepts evidence backed by a project', () => {
    const output = parseCandidateEvidenceJson(
      evidenceJson({
        evidenceLevel: 'medium',
        evidenceText: 'Desarrollé una API REST utilizando NestJS',
        sourceType: 'project',
      }),
    );

    expect(output.evidence[0]).toMatchObject({
      evidenceLevel: 'medium',
      sourceType: 'project',
    });
    expect(() =>
      assertCandidateEvidenceIsGrounded(
        output,
        'Proyecto personal: Desarrollé una API REST utilizando NestJS.',
      ),
    ).not.toThrow();
  });

  it('preserves null years when the CV does not state them', () => {
    const output = parseCandidateEvidenceJson(
      evidenceJson({
        evidenceLevel: 'medium',
        evidenceText: 'Construí servicios con NestJS',
        sourceType: 'project',
      }),
    );

    expect(output.evidence[0]?.years).toBeNull();
  });

  it('preserves unknown classifications', () => {
    const output = parseCandidateEvidenceJson(
      evidenceJson({
        category: 'unknown',
        evidenceLevel: 'unknown',
        evidenceText: 'Participé en iniciativas internas',
        skill: 'Iniciativas internas',
        sourceType: 'unknown',
      }),
    );

    expect(output.evidence[0]).toMatchObject({
      category: 'unknown',
      evidenceLevel: 'unknown',
      sourceType: 'unknown',
    });
  });

  it('rejects evidence text that does not exist in the CV', () => {
    const output = parseCandidateEvidenceJson(evidenceJson());

    expect(() => assertCandidateEvidenceIsGrounded(output, 'Skills: TypeScript')).toThrow(
      InvalidCandidateEvidenceOutputError,
    );
  });

  it('rejects malformed output and inflated skills-section evidence', () => {
    expect(() => parseCandidateEvidenceJson('{"evidence":[{"skill":"NestJS"}]}')).toThrow(
      InvalidCandidateEvidenceOutputError,
    );
    expect(() => parseCandidateEvidenceJson(evidenceJson({ evidenceLevel: 'strong' }))).toThrow(
      InvalidCandidateEvidenceOutputError,
    );
  });
});
