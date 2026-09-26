export const JOB_REQUIREMENT_CATEGORIES = [
  'technology',
  'skill',
  'experience',
  'education',
  'language',
  'other',
  'unknown',
] as const;

export const JOB_REQUIREMENT_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'unknown',
] as const;

export type JobRequirementCategory = (typeof JOB_REQUIREMENT_CATEGORIES)[number];
export type JobRequirementLevel = (typeof JOB_REQUIREMENT_LEVELS)[number];

export interface JobRequirement {
  category: JobRequirementCategory;
  evidenceText: string;
  level: JobRequirementLevel;
  name: string;
  required: boolean | null;
  years: number | null;
}

export interface ExtractedJobRequirements {
  requirements: JobRequirement[];
}

export interface JobRequirementsInput {
  description: string;
  title: string;
}

export const JOB_REQUIREMENTS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1 },
          category: { type: 'string', enum: JOB_REQUIREMENT_CATEGORIES },
          level: { type: 'string', enum: JOB_REQUIREMENT_LEVELS },
          required: { type: ['boolean', 'null'] },
          years: { type: ['integer', 'null'], minimum: 0 },
          evidenceText: { type: 'string', minLength: 1 },
        },
        required: ['name', 'category', 'level', 'required', 'years', 'evidenceText'],
      },
    },
  },
  required: ['requirements'],
} as const;
