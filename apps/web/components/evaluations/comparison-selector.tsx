'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ComparisonEvaluationOption } from '../../lib/comparisons-api';

interface ComparisonSelectorProps {
  evaluations: ComparisonEvaluationOption[];
  initialSelection: string[];
  jobId: string;
}

export function ComparisonSelector({
  evaluations,
  initialSelection,
  jobId,
}: ComparisonSelectorProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const evaluationIds = formData
      .getAll('evaluationIds')
      .filter((value): value is string => typeof value === 'string');
    if (evaluationIds.length < 2) {
      setError('Selecciona al menos dos candidatos evaluados.');
      return;
    }
    const query = new URLSearchParams({ evaluationIds: evaluationIds.join(',') });
    router.push(`/jobs/${jobId}/compare?${query.toString()}`);
  }

  return (
    <form className="comparison-selector" onSubmit={handleSubmit}>
      <fieldset>
        <legend>Candidatos ya evaluados</legend>
        {evaluations.length === 0 ? <p>No existen evaluaciones para esta vacante.</p> : null}
        {evaluations.map((evaluation) => (
          <label key={evaluation.evaluationId}>
            <input
              type="checkbox"
              name="evaluationIds"
              value={evaluation.evaluationId}
              defaultChecked={initialSelection.includes(evaluation.evaluationId)}
            />
            <span>
              {evaluation.candidateName} ·{' '}
              {evaluation.score === null
                ? 'score no disponible'
                : `${Math.round(evaluation.score * 100)} / 100`}
            </span>
          </label>
        ))}
      </fieldset>
      {error ? <p className="error-message">{error}</p> : null}
      <button type="submit" disabled={evaluations.length < 2}>
        Comparar seleccionados
      </button>
    </form>
  );
}
