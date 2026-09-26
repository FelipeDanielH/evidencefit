import Link from 'next/link';
import { RequirementsPanel } from '../../../components/jobs/requirements-panel';
import { getJob, type JobDetail } from '../../../lib/jobs-api';
import { requireAccessToken } from '../../../lib/server-session';

export const dynamic = 'force-dynamic';

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const accessToken = await requireAccessToken();
  let job: JobDetail | null = null;
  let error: string | null = null;
  try {
    job = await getJob(id, accessToken);
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error ? requestError.message : 'No fue posible cargar la vacante.';
  }

  if (!job) {
    return (
      <main>
        <Link href="/jobs">← Volver a vacantes</Link>
        <p className="error-message">{error ?? 'Vacante no encontrada.'}</p>
      </main>
    );
  }

  return (
    <main>
      <Link href="/jobs">← Volver a vacantes</Link>
      <p className="eyebrow page-kicker">Detalle de vacante</p>
      <h1>{job.title}</h1>
      <Link className="button-link" href={`/jobs/${job.id}/compare`}>
        Comparar candidatos evaluados
      </Link>
      <section aria-labelledby="description-heading">
        <h2 id="description-heading">Descripción original</h2>
        <p className="job-description">{job.description}</p>
      </section>
      <RequirementsPanel jobId={job.id} initialExtraction={job.requirementsExtraction} />
    </main>
  );
}
