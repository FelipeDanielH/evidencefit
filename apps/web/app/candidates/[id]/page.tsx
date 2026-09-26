import Link from 'next/link';
import { EvidencePanel } from '../../../components/candidates/evidence-panel';
import { getCandidate, type CandidateDetail } from '../../../lib/candidates-api';
import { requireAccessToken } from '../../../lib/server-session';

export const dynamic = 'force-dynamic';

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id } = await params;
  const accessToken = await requireAccessToken();
  let candidate: CandidateDetail | null = null;
  let error: string | null = null;
  try {
    candidate = await getCandidate(id, accessToken);
  } catch (requestError: unknown) {
    error =
      requestError instanceof Error ? requestError.message : 'No fue posible cargar el candidato.';
  }

  if (!candidate) {
    return (
      <main>
        <Link href="/candidates">← Volver a candidatos</Link>
        <p className="error-message">{error ?? 'Candidato no encontrado.'}</p>
      </main>
    );
  }

  return (
    <main>
      <Link href="/candidates">← Volver a candidatos</Link>
      <p className="eyebrow page-kicker">Detalle de candidato sintético</p>
      <h1>{candidate.name}</h1>
      <section aria-labelledby="cv-heading">
        <h2 id="cv-heading">CV original</h2>
        <p className="cv-text">{candidate.cvText}</p>
      </section>
      <EvidencePanel candidateId={candidate.id} initialExtraction={candidate.evidenceExtraction} />
    </main>
  );
}
