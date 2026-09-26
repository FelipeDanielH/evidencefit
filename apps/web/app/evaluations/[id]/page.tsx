import Link from 'next/link';
import { listCandidates, type CandidateSummary } from '../../../lib/candidates-api';
import {
  getEvaluation,
  type EvaluationDetail,
  type MatchStatus,
} from '../../../lib/evaluations-api';
import { listJobs, type JobSummary } from '../../../lib/jobs-api';
import { requireAccessToken } from '../../../lib/server-session';

export const dynamic = 'force-dynamic';

interface EvaluationPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Readonly<Record<MatchStatus, string>> = {
  strong: 'Fuerte',
  medium: 'Media',
  weak: 'Débil',
  unknown: 'Desconocida',
  not_found: 'No encontrada',
};

export default async function EvaluationPage({ params }: EvaluationPageProps) {
  const { id } = await params;
  const accessToken = await requireAccessToken();
  let evaluation: EvaluationDetail | null = null;
  let jobs: JobSummary[] = [];
  let candidates: CandidateSummary[] = [];
  let error: string | null = null;

  try {
    [evaluation, jobs, candidates] = await Promise.all([
      getEvaluation(id, accessToken),
      listJobs(accessToken),
      listCandidates(accessToken),
    ]);
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error ? requestError.message : 'No fue posible cargar la evaluación.';
  }

  if (!evaluation) {
    return (
      <main>
        <Link href="/evaluations/new">← Nueva evaluación</Link>
        <p className="error-message">{error ?? 'Evaluación no encontrada.'}</p>
      </main>
    );
  }

  const jobName = jobs.find((job) => job.id === evaluation.jobId)?.title ?? evaluation.jobId;
  const candidateName =
    candidates.find((candidate) => candidate.id === evaluation.candidateId)?.name ??
    evaluation.candidateId;

  return (
    <main>
      <Link href="/evaluations/new">← Nueva evaluación</Link>
      <p className="eyebrow page-kicker">Resultado explicable</p>
      <h1>{candidateName}</h1>
      <p>
        Evaluación para <strong>{jobName}</strong>
      </p>
      <section className="score-card" aria-labelledby="score-heading">
        <p className="eyebrow">Score heurístico</p>
        <h2 id="score-heading">
          {evaluation.score === null
            ? 'Sin requisitos'
            : `${Math.round(evaluation.score * 100)} / 100`}
        </h2>
        <p>
          Este valor resume reglas internas del prototipo; no es una probabilidad de contratación.
        </p>
      </section>

      <section aria-labelledby="matches-heading">
        <h2 id="matches-heading">Resultado por requisito</h2>
        {evaluation.result.matches.length === 0 ? (
          <p>La extracción de la vacante no contiene requisitos.</p>
        ) : null}
        {evaluation.result.matches.map((match) => (
          <article className="match-card" key={match.requirement.name}>
            <div className="requirement-title">
              <h3>{match.requirement.name}</h3>
              <span className={`status status-${match.status}`}>{STATUS_LABELS[match.status]}</span>
            </div>
            <dl>
              <div>
                <dt>Confianza</dt>
                <dd>{Math.round(match.confidence * 100)}%</dd>
              </div>
              <div>
                <dt>Requerido</dt>
                <dd>
                  {match.requirement.required === null
                    ? 'No indicado'
                    : match.requirement.required
                      ? 'Obligatorio'
                      : 'Deseable'}
                </dd>
              </div>
              <div>
                <dt>Años requeridos</dt>
                <dd>{match.requirement.years ?? 'No indicados'}</dd>
              </div>
            </dl>
            <p>{match.explanation}</p>

            {match.matchedEvidence.map((evidence) => (
              <blockquote key={evidence.text}>
                {evidence.text}
                <small>
                  Fuente: {evidence.sourceType} · evidencia {evidence.evidenceLevel}
                </small>
              </blockquote>
            ))}

            {match.missingInformation.length > 0 ? (
              <>
                <h4>Información faltante</h4>
                <ul>
                  {match.missingInformation.map((missing) => (
                    <li key={missing}>{missing}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
