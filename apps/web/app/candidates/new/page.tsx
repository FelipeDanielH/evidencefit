import Link from 'next/link';
import { CandidateForm } from '../../../components/candidates/candidate-form';

export default function NewCandidatePage() {
  return (
    <main>
      <Link href="/candidates">← Volver a candidatos</Link>
      <p className="eyebrow page-kicker">Nuevo candidato sintético</p>
      <h1>Crear candidato</h1>
      <p>
        Usa únicamente información inventada para la demo. EvidenceFit guardará el texto original
        para verificar cada evidencia extraída.
      </p>
      <CandidateForm />
    </main>
  );
}
