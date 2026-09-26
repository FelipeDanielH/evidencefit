import Link from 'next/link';
import { EvaluationForm } from '../../../components/evaluations/evaluation-form';
import { listCandidates, type CandidateSummary } from '../../../lib/candidates-api';
import { listJobs, type JobSummary } from '../../../lib/jobs-api';
import { requireAccessToken } from '../../../lib/server-session';

export const dynamic = 'force-dynamic';

export default async function NewEvaluationPage() {
  const accessToken = await requireAccessToken();
  let jobs: JobSummary[] = [];
  let candidates: CandidateSummary[] = [];
  let error: string | null = null;
  try {
    [jobs, candidates] = await Promise.all([listJobs(accessToken), listCandidates(accessToken)]);
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error
        ? requestError.message
        : 'No fue posible cargar las opciones de evaluación.';
  }

  return (
    <main>
      <Link href="/">← Volver al inicio</Link>
      <p className="eyebrow page-kicker">Matching explicable</p>
      <h1>Nueva evaluación</h1>
      <p>
        La vacante debe tener requisitos extraídos y el candidato debe tener evidencia extraída.
      </p>
      {error ? <p className="error-message">{error}</p> : null}
      {!error ? <EvaluationForm candidates={candidates} jobs={jobs} /> : null}
    </main>
  );
}
