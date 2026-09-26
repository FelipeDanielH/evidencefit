import Link from 'next/link';
import { JobForm } from '../../../components/jobs/job-form';

export default function NewJobPage() {
  return (
    <main>
      <Link href="/jobs">← Volver a vacantes</Link>
      <p className="eyebrow page-kicker">Nueva vacante</p>
      <h1>Crear vacante</h1>
      <p>
        Guarda el texto original. La extracción de requisitos se ejecuta después desde el detalle.
      </p>
      <JobForm />
    </main>
  );
}
