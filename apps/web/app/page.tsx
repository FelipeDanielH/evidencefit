import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">EvidenceFit · v0.1</p>
      <h1>Matching explicable, desde la evidencia.</h1>
      <p>
        Conserva vacantes y CVs sintéticos, y extrae información verificable con una referencia
        explícita al texto de origen.
      </p>
      <div className="home-actions">
        <Link className="button-link" href="/jobs">
          Abrir vacantes
        </Link>
        <Link className="button-link secondary" href="/candidates">
          Abrir candidatos
        </Link>
        <Link className="button-link secondary" href="/evaluations/new">
          Evaluar candidato
        </Link>
      </div>
      <section aria-labelledby="current-status">
        <h2 id="current-status">Estado actual</h2>
        <ul>
          <li>Frontend Next.js con App Router</li>
          <li>API NestJS modular</li>
          <li>Vacantes persistidas en PostgreSQL</li>
          <li>Requisitos estructurados almacenados en MongoDB</li>
          <li>Candidatos sintéticos en PostgreSQL y evidencia derivada en MongoDB</li>
          <li>Matching determinista y scoring heurístico explicable</li>
        </ul>
      </section>
    </main>
  );
}
