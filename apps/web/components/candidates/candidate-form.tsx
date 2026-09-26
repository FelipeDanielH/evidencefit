'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createCandidate } from '../../lib/candidates-api';

export function CandidateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name');
    const cvText = formData.get('cvText');
    if (typeof name !== 'string' || typeof cvText !== 'string') {
      setError('Completa los datos del candidato sintético.');
      setIsSubmitting(false);
      return;
    }

    try {
      const candidate = await createCandidate({ name, cvText, isSynthetic: true });
      router.push(`/candidates/${candidate.id}`);
      router.refresh();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'No fue posible crear el candidato.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form className="candidate-form" onSubmit={handleSubmit}>
      <label htmlFor="name">Nombre ficticio</label>
      <input id="name" name="name" minLength={2} maxLength={120} required />

      <label htmlFor="cvText">CV sintético en texto</label>
      <textarea id="cvText" name="cvText" minLength={20} maxLength={50000} required />

      <label className="synthetic-confirmation">
        <input type="checkbox" checked readOnly />
        Confirmo que este CV es completamente sintético.
      </label>

      {error ? <p className="error-message">{error}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Crear candidato'}
      </button>
    </form>
  );
}
