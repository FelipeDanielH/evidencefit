import {
  JOB_REQUIREMENT_CATEGORIES,
  JOB_REQUIREMENT_LEVELS,
  type ExtractedJobRequirements,
  type JobRequirement,
  type JobRequirementCategory,
  type JobRequirementLevel,
} from './job-requirements.types.js';

const ROOT_KEYS = ['requirements'];
const REQUIREMENT_KEYS = ['name', 'category', 'level', 'required', 'years', 'evidenceText'];

export class InvalidJobRequirementsOutputError extends Error {
  constructor(message = 'The AI output does not match the job requirements schema.') {
    super(message);
    this.name = 'InvalidJobRequirementsOutputError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

function isCategory(value: unknown): value is JobRequirementCategory {
  return (
    typeof value === 'string' && JOB_REQUIREMENT_CATEGORIES.some((category) => category === value)
  );
}

function isLevel(value: unknown): value is JobRequirementLevel {
  return typeof value === 'string' && JOB_REQUIREMENT_LEVELS.some((level) => level === value);
}

function parseRequirement(value: unknown, index: number): JobRequirement {
  if (!isRecord(value) || !hasOnlyKeys(value, REQUIREMENT_KEYS)) {
    throw new InvalidJobRequirementsOutputError(`Requirement ${index} has invalid fields.`);
  }

  const { category, evidenceText, level, name, required, years } = value;
  if (typeof name !== 'string' || !name.trim()) {
    throw new InvalidJobRequirementsOutputError(`Requirement ${index} has an invalid name.`);
  }
  if (!isCategory(category) || !isLevel(level)) {
    throw new InvalidJobRequirementsOutputError(`Requirement ${index} has invalid enums.`);
  }
  if (required !== null && typeof required !== 'boolean') {
    throw new InvalidJobRequirementsOutputError(
      `Requirement ${index} has an invalid required flag.`,
    );
  }
  if (years !== null && (typeof years !== 'number' || !Number.isInteger(years) || years < 0)) {
    throw new InvalidJobRequirementsOutputError(`Requirement ${index} has invalid years.`);
  }
  if (typeof evidenceText !== 'string' || !evidenceText.trim()) {
    throw new InvalidJobRequirementsOutputError(`Requirement ${index} has invalid evidence.`);
  }

  return {
    category,
    evidenceText: evidenceText.trim(),
    level,
    name: name.trim(),
    required,
    years,
  };
}

export function parseJobRequirementsJson(content: string): ExtractedJobRequirements {
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    throw new InvalidJobRequirementsOutputError('The AI output is not valid JSON.');
  }

  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ROOT_KEYS) ||
    !Array.isArray(payload.requirements)
  ) {
    throw new InvalidJobRequirementsOutputError();
  }

  return {
    requirements: payload.requirements.map((requirement, index) =>
      parseRequirement(requirement, index),
    ),
  };
}

function normalizeEvidence(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function assertRequirementsAreGrounded(
  output: ExtractedJobRequirements,
  description: string,
): void {
  const normalizedDescription = normalizeEvidence(description);

  for (const requirement of output.requirements) {
    const normalizedEvidence = normalizeEvidence(requirement.evidenceText);
    if (!normalizedDescription.includes(normalizedEvidence)) {
      throw new InvalidJobRequirementsOutputError(
        `Evidence for requirement "${requirement.name}" is not present in the source description.`,
      );
    }
  }
}
