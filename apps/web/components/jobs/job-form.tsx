'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createJob } from '../../lib/jobs-api';

export function JobForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const title = formData.get('title');
    const description = formData.get('description');
    if (typeof title !== 'string' || typeof description !== 'string') {
      setError('Completa los datos de la vacante.');
      setIsSubmitting(false);
      return;
    }

    try {
      const job = await createJob({ title, description });
      router.push(`/jobs/${job.id}`);
      router.refresh();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'No fue posible crear la vacante.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <label htmlFor="title">Título</label>
      <input id="title" name="title" minLength={2} maxLength={120} required />

      <label htmlFor="description">Descripción</label>
      <textarea id="description" name="description" minLength={20} maxLength={20000} required />

      {error ? <p className="error-message">{error}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Crear vacante'}
      </button>
    </form>
  );
}
