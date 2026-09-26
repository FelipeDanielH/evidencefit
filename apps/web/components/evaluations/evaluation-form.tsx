'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { CandidateSummary } from '../../lib/candidates-api';
import { createEvaluation } from '../../lib/evaluations-api';
import type { JobSummary } from '../../lib/jobs-api';

interface EvaluationFormProps {
  candidates: CandidateSummary[];
  jobs: JobSummary[];
}

export function EvaluationForm({ candidates, jobs }: EvaluationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const jobId = formData.get('jobId');
    const candidateId = formData.get('candidateId');
    if (typeof jobId !== 'string' || typeof candidateId !== 'string') {
      setError('Selecciona una vacante y un candidato.');
      setIsSubmitting(false);
      return;
    }

    try {
      const evaluation = await createEvaluation({ candidateId, jobId });
      router.push(`/evaluations/${evaluation.id}`);
      router.refresh();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible ejecutar la evaluación.',
      );
      setIsSubmitting(false);
    }
  }

  const cannotEvaluate = jobs.length === 0 || candidates.length === 0;

  return (
    <form className="evaluation-form" onSubmit={handleSubmit}>
      <label htmlFor="jobId">Vacante</label>
      <select id="jobId" name="jobId" required defaultValue="">
        <option value="" disabled>
          Selecciona una vacante
        </option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}
          </option>
        ))}
      </select>

      <label htmlFor="candidateId">Candidato sintético</label>
      <select id="candidateId" name="candidateId" required defaultValue="">
        <option value="" disabled>
          Selecciona un candidato
        </option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>

      {cannotEvaluate ? <p>Crea al menos una vacante y un candidato antes de evaluar.</p> : null}
      {error ? <p className="error-message">{error}</p> : null}
      <button type="submit" disabled={isSubmitting || cannotEvaluate}>
        {isSubmitting ? 'Evaluando…' : 'Ejecutar evaluación'}
      </button>
    </form>
  );
}
