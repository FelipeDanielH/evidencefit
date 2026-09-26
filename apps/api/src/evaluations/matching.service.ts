import { Injectable } from '@nestjs/common';
import type { CandidateEvidence } from '../ai/candidate-evidence.types.js';
import type { JobRequirement } from '../ai/job-requirements.types.js';
import type {
  EvaluationResult,
  MatchStatus,
  MatchedEvidence,
  RequirementMatch,
} from './evaluation.types.js';

const STATUS_VALUES: Readonly<Record<MatchStatus, number>> = {
  strong: 1,
  medium: 0.7,
  weak: 0.4,
  unknown: 0.2,
  not_found: 0,
};

const STATUS_ORDER: readonly MatchStatus[] = ['not_found', 'unknown', 'weak', 'medium', 'strong'];

export function normalizeSkillName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function strongestStatus(evidence: CandidateEvidence[]): MatchStatus {
  return evidence.reduce<MatchStatus>((best, item) => {
    const candidateStatus: MatchStatus = item.evidenceLevel;
    return STATUS_ORDER.indexOf(candidateStatus) > STATUS_ORDER.indexOf(best)
      ? candidateStatus
      : best;
  }, 'unknown');
}

function capStatus(status: MatchStatus, maximum: MatchStatus): MatchStatus {
  return STATUS_ORDER.indexOf(status) > STATUS_ORDER.indexOf(maximum) ? maximum : status;
}

function toMatchedEvidence(evidence: CandidateEvidence): MatchedEvidence {
  return {
    category: evidence.category,
    confidence: evidence.confidence,
    evidenceLevel: evidence.evidenceLevel,
    sourceType: evidence.sourceType,
    text: evidence.evidenceText,
    years: evidence.years,
  };
}

function makeExplanation(status: MatchStatus, missingInformation: string[]): string {
  const base: Readonly<Record<MatchStatus, string>> = {
    strong: 'La evidencia extraída respalda de forma directa este requisito.',
    medium: 'Existe evidencia práctica relevante, pero no permite confirmar todo el requisito.',
    weak: 'Existe una mención o evidencia limitada relacionada con el requisito.',
    unknown: 'Existe información relacionada, pero no alcanza para determinar el cumplimiento.',
    not_found: 'No se encontró evidencia con el mismo nombre normalizado en la extracción vigente.',
  };
  return missingInformation.length === 0
    ? base[status]
    : `${base[status]} Falta: ${missingInformation.join(' ')}`;
}

function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

@Injectable()
export class MatchingService {
  evaluate(
    requirements: JobRequirement[],
    candidateEvidence: CandidateEvidence[],
  ): EvaluationResult {
    const matches = requirements.map((requirement) =>
      this.matchRequirement(requirement, candidateEvidence),
    );
    return { matches, score: this.calculateScore(matches) };
  }

  calculateScore(matches: RequirementMatch[]): number | null {
    if (matches.length === 0) return null;

    let weightedTotal = 0;
    let totalWeight = 0;
    for (const match of matches) {
      const weight = match.requirement.required === true ? 2 : 1;
      weightedTotal += STATUS_VALUES[match.status] * weight;
      totalWeight += weight;
    }
    return roundScore(weightedTotal / totalWeight);
  }

  private matchRequirement(
    requirement: JobRequirement,
    candidateEvidence: CandidateEvidence[],
  ): RequirementMatch {
    const normalizedRequirement = normalizeSkillName(requirement.name);
    const relatedEvidence = candidateEvidence.filter(
      (evidence) => normalizeSkillName(evidence.skill) === normalizedRequirement,
    );
    const requirementSnapshot = {
      category: requirement.category,
      level: requirement.level,
      name: requirement.name,
      required: requirement.required,
      years: requirement.years,
    };

    if (relatedEvidence.length === 0) {
      const missingInformation = ['No se encontró evidencia relevante en la extracción vigente.'];
      return {
        confidence: 0,
        explanation: makeExplanation('not_found', missingInformation),
        matchedEvidence: [],
        missingInformation,
        requirement: requirementSnapshot,
        status: 'not_found',
      };
    }

    let status = strongestStatus(relatedEvidence);
    const missingInformation: string[] = [];

    if (requirement.years !== null) {
      const statedYears = relatedEvidence
        .map((evidence) => evidence.years)
        .filter((years): years is number => years !== null);
      if (statedYears.length === 0) {
        missingInformation.push(
          `No existe evidencia suficiente para acreditar ${requirement.years} años de experiencia.`,
        );
        status = capStatus(status, 'medium');
      } else if (Math.max(...statedYears) < requirement.years) {
        missingInformation.push(
          `La evidencia declara menos de los ${requirement.years} años requeridos.`,
        );
        status = capStatus(status, 'weak');
      }
    }

    if (requirement.level !== 'unknown') {
      missingInformation.push(
        `La evidencia no acredita explícitamente el nivel ${requirement.level}.`,
      );
      status = capStatus(status, 'medium');
    }

    if (status === 'unknown') {
      missingInformation.push('La evidencia relacionada tiene un nivel desconocido.');
    }

    const confidence = Math.max(...relatedEvidence.map((evidence) => evidence.confidence));
    return {
      confidence,
      explanation: makeExplanation(status, missingInformation),
      matchedEvidence: relatedEvidence.map(toMatchedEvidence),
      missingInformation,
      requirement: requirementSnapshot,
      status,
    };
  }
}
