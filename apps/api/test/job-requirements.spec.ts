import {
  InvalidJobRequirementsOutputError,
  assertRequirementsAreGrounded,
  parseJobRequirementsJson,
} from '../src/ai/job-requirements.parser.js';

describe('job requirements output validation', () => {
  it('rejects invalid AI output', () => {
    expect(() => parseJobRequirementsJson('{"requirements":[{"name":"NestJS"}]}')).toThrow(
      InvalidJobRequirementsOutputError,
    );
  });

  it('keeps unknown level and null years when the source does not specify them', () => {
    const output = parseJobRequirementsJson(
      JSON.stringify({
        requirements: [
          {
            name: 'NestJS',
            category: 'technology',
            level: 'unknown',
            required: null,
            years: null,
            evidenceText: 'Experiencia con NestJS',
          },
        ],
      }),
    );

    expect(output.requirements[0]).toMatchObject({ level: 'unknown', years: null });
    expect(() =>
      assertRequirementsAreGrounded(output, 'Se valora experiencia con NestJS.'),
    ).not.toThrow();
  });

  it('rejects evidence that is not present in the job description', () => {
    const output = parseJobRequirementsJson(
      JSON.stringify({
        requirements: [
          {
            name: 'Kubernetes',
            category: 'technology',
            level: 'advanced',
            required: true,
            years: 5,
            evidenceText: '5 años de Kubernetes avanzado',
          },
        ],
      }),
    );

    expect(() => assertRequirementsAreGrounded(output, 'Buscamos experiencia con NestJS.')).toThrow(
      InvalidJobRequirementsOutputError,
    );
  });
});
