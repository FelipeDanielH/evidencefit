'use client';

import { useState } from 'react';
import {
  extractCandidateEvidence,
  type CandidateEvidenceExtraction,
} from '../../lib/candidates-api';

interface EvidencePanelProps {
  candidateId: string;
  initialExtraction: CandidateEvidenceExtraction | null;
}

export function EvidencePanel({ candidateId, initialExtraction }: EvidencePanelProps) {
  const [extraction, setExtraction] = useState(initialExtraction);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  async function handleExtraction(): Promise<void> {
    setError(null);
    setIsExtracting(true);
    try {
      setExtraction(await extractCandidateEvidence(candidateId));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible extraer la evidencia.',
      );
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <section aria-labelledby="evidence-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Extracción estructurada</p>
          <h2 id="evidence-heading">Evidencia</h2>
        </div>
        <button type="button" onClick={handleExtraction} disabled={isExtracting}>
          {isExtracting ? 'Extrayendo…' : 'Extraer evidencia'}
        </button>
      </div>

      {error ? <p className="error-message">{error}</p> : null}
      {!extraction ? <p>Aún no se ha extraído evidencia de este CV.</p> : null}
      {extraction && extraction.evidence.length === 0 ? (
        <p>El CV no contiene evidencia verificable.</p>
      ) : null}

      {extraction?.evidence.map((item) => (
        <article className="evidence-card" key={`${item.skill}-${item.evidenceText}`}>
          <div className="requirement-title">
            <h3>{item.skill}</h3>
            <span>{item.category}</span>
          </div>
          <dl>
            <div>
              <dt>Nivel de evidencia</dt>
              <dd>{item.evidenceLevel === 'unknown' ? 'Desconocido' : item.evidenceLevel}</dd>
            </div>
            <div>
              <dt>Fuente</dt>
              <dd>{item.sourceType === 'unknown' ? 'Desconocida' : item.sourceType}</dd>
            </div>
            <div>
              <dt>Años</dt>
              <dd>{item.years ?? 'No indicados'}</dd>
            </div>
            <div>
              <dt>Confianza</dt>
              <dd>{Math.round(item.confidence * 100)}%</dd>
            </div>
          </dl>
          <blockquote>{item.evidenceText}</blockquote>
        </article>
      ))}
    </section>
  );
}
