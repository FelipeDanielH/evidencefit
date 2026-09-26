'use client';

import { useState } from 'react';
import { extractJobRequirements, type JobRequirementsExtraction } from '../../lib/jobs-api';

interface RequirementsPanelProps {
  initialExtraction: JobRequirementsExtraction | null;
  jobId: string;
}

function formatRequired(required: boolean | null): string {
  if (required === null) return 'No indicado';
  return required ? 'Obligatorio' : 'Deseable';
}

export function RequirementsPanel({ initialExtraction, jobId }: RequirementsPanelProps) {
  const [extraction, setExtraction] = useState(initialExtraction);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  async function handleExtraction(): Promise<void> {
    setError(null);
    setIsExtracting(true);
    try {
      setExtraction(await extractJobRequirements(jobId));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible extraer los requisitos.',
      );
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <section aria-labelledby="requirements-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Extracción estructurada</p>
          <h2 id="requirements-heading">Requisitos</h2>
        </div>
        <button type="button" onClick={handleExtraction} disabled={isExtracting}>
          {isExtracting ? 'Extrayendo…' : 'Extraer requisitos'}
        </button>
      </div>

      {error ? <p className="error-message">{error}</p> : null}
      {!extraction ? <p>Aún no se han extraído requisitos para esta vacante.</p> : null}
      {extraction && extraction.requirements.length === 0 ? (
        <p>La descripción no contiene requisitos explícitos.</p>
      ) : null}

      {extraction?.requirements.map((requirement) => (
        <article
          className="requirement-card"
          key={`${requirement.name}-${requirement.evidenceText}`}
        >
          <div className="requirement-title">
            <h3>{requirement.name}</h3>
            <span>{requirement.category}</span>
          </div>
          <dl>
            <div>
              <dt>Nivel</dt>
              <dd>{requirement.level === 'unknown' ? 'No indicado' : requirement.level}</dd>
            </div>
            <div>
              <dt>Años</dt>
              <dd>{requirement.years ?? 'No indicado'}</dd>
            </div>
            <div>
              <dt>Prioridad</dt>
              <dd>{formatRequired(requirement.required)}</dd>
            </div>
          </dl>
          <blockquote>{requirement.evidenceText}</blockquote>
        </article>
      ))}
    </section>
  );
}
