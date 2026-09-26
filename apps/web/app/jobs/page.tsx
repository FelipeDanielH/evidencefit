import Link from 'next/link';
import { listJobs, type JobSummary } from '../../lib/jobs-api';
import { requireAccessToken } from '../../lib/server-session';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const accessToken = await requireAccessToken();
  let jobs: JobSummary[] = [];
  let error: string | null = null;
  try {
    jobs = await listJobs(accessToken);
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error ? requestError.message : 'No fue posible cargar vacantes.';
  }

  return (
    <main>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Vacantes</p>
          <h1>Vacantes creadas</h1>
        </div>
        <Link className="button-link" href="/jobs/new">
          Nueva vacante
        </Link>
      </div>

      {error ? <p className="error-message">{error}</p> : null}
      {!error && jobs.length === 0 ? <p>No hay vacantes todavía.</p> : null}
      <div className="job-list">
        {jobs.map((job) => (
          <article key={job.id}>
            <p className="eyebrow">Creada {new Date(job.createdAt).toLocaleDateString('es-CL')}</p>
            <h2>{job.title}</h2>
            <p>{job.description.slice(0, 180)}</p>
            <Link href={`/jobs/${job.id}`}>Ver detalle</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
