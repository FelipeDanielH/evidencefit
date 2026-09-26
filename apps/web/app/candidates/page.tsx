import Link from 'next/link';
import { listCandidates, type CandidateSummary } from '../../lib/candidates-api';
import { requireAccessToken } from '../../lib/server-session';

export const dynamic = 'force-dynamic';

export default async function CandidatesPage() {
  const accessToken = await requireAccessToken();
  let candidates: CandidateSummary[] = [];
  let error: string | null = null;
  try {
    candidates = await listCandidates(accessToken);
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error ? requestError.message : 'No fue posible cargar candidatos.';
  }

  return (
    <main>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Candidatos sintéticos</p>
          <h1>Candidatos creados</h1>
        </div>
        <Link className="button-link" href="/candidates/new">
          Nuevo candidato
        </Link>
      </div>

      {error ? <p className="error-message">{error}</p> : null}
      {!error && candidates.length === 0 ? <p>No hay candidatos todavía.</p> : null}
      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article key={candidate.id}>
            <p className="eyebrow">
              Creado {new Date(candidate.createdAt).toLocaleDateString('es-CL')}
            </p>
            <h2>{candidate.name}</h2>
            <p>{candidate.cvText.slice(0, 180)}</p>
            <Link href={`/candidates/${candidate.id}`}>Ver detalle</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
