import Link from 'next/link';
import { ComparisonSelector } from '../../../../components/evaluations/comparison-selector';
import {
  compareJobEvaluations,
  listJobEvaluations,
  type JobComparison,
} from '../../../../lib/comparisons-api';
import { requireAccessToken } from '../../../../lib/server-session';

export const dynamic = 'force-dynamic';

interface ComparePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evaluationIds?: string | string[] }>;
}

function parseEvaluationIds(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function ComparePage({ params, searchParams }: ComparePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const accessToken = await requireAccessToken();
  const selectedIds = parseEvaluationIds(query.evaluationIds);
  let selection: Awaited<ReturnType<typeof listJobEvaluations>> | null = null;
  let comparison: JobComparison | null = null;
  let error: string | null = null;

  try {
    selection = await listJobEvaluations(id, accessToken);
    if (selectedIds.length >= 2) {
      comparison = await compareJobEvaluations(id, selectedIds, accessToken);
    }
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error
        ? requestError.message
        : 'No fue posible cargar la comparación.';
  }

  if (!selection) {
    return (
      <main>
        <Link href={`/jobs/${id}`}>← Volver a la vacante</Link>
        <p className="error-message">{error ?? 'Vacante no encontrada.'}</p>
      </main>
    );
  }

  return (
    <main className="comparison-page">
      <Link href={`/jobs/${id}`}>← Volver a la vacante</Link>
      <p className="eyebrow page-kicker">Comparación on-demand</p>
      <h1>{selection.job.title}</h1>
      <p>Selecciona al menos dos candidatos que ya tengan una evaluación terminada.</p>

      <ComparisonSelector
        evaluations={selection.evaluations}
        initialSelection={selectedIds}
        jobId={id}
      />

      {error ? <p className="error-message">{error}</p> : null}
      {comparison ? (
        <section aria-labelledby="comparison-heading">
          <h2 id="comparison-heading">Comparación por requisito</h2>
          <p>
            Ordenado según score heurístico de EvidenceFit. Este orden no constituye una
            recomendación de contratación.
          </p>
          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col">Requisito</th>
                  {comparison.candidates.map((candidate) => (
                    <th scope="col" key={candidate.evaluationId}>
                      {candidate.name}
                      <small>
                        {candidate.score === null
                          ? 'Score no disponible'
                          : `${Math.round(candidate.score * 100)} / 100`}
                        {candidate.scoreTied ? ' · empate' : ''}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.requirements.map((requirement) => (
                  <tr
                    key={JSON.stringify([
                      requirement.name,
                      requirement.category,
                      requirement.level,
                      requirement.required,
                      requirement.years,
                    ])}
                  >
                    <th scope="row">
                      {requirement.name}
                      <small>
                        {requirement.required === true
                          ? 'Obligatorio'
                          : requirement.required === false
                            ? 'Deseable'
                            : 'Prioridad no indicada'}
                      </small>
                    </th>
                    {comparison.candidates.map((candidate) => {
                      const result = requirement.results.find(
                        (item) => item.evaluationId === candidate.evaluationId,
                      );
                      return (
                        <td key={candidate.evaluationId}>
                          {!result ? <p>Sin resultado comparable.</p> : null}
                          {result ? (
                            <>
                              <span className={`status status-${result.status}`}>
                                {result.status}
                              </span>
                              {result.isStrength ? (
                                <p className="signal strength">Fortaleza</p>
                              ) : null}
                              {result.hasRequiredGap ? (
                                <p className="signal gap">Gap obligatorio</p>
                              ) : null}
                              {result.isUnknown ? (
                                <p className="signal unknown">Información insuficiente</p>
                              ) : null}
                              <p>Confianza: {Math.round(result.confidence * 100)}%</p>
                              {result.evidence.map((evidence) => (
                                <blockquote key={evidence.text}>{evidence.text}</blockquote>
                              ))}
                              {result.missingInformation.length > 0 ? (
                                <ul>
                                  {result.missingInformation.map((missing) => (
                                    <li key={missing}>{missing}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
