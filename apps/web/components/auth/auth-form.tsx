'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface AuthFormProps {
  mode: 'login' | 'register';
}

function getMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = payload.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(' ');
    }
  }
  return 'No fue posible completar la autenticación.';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    if (typeof email !== 'string' || typeof password !== 'string') {
      setError('Completa email y contraseña.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getMessage(payload));
      router.push('/jobs');
      router.refresh();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : getMessage(null));
      setIsSubmitting(false);
    }
  }

  const isRegister = mode === 'register';
  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" maxLength={254} autoComplete="email" required />
      <label htmlFor="password">Contraseña</label>
      <input
        id="password"
        name="password"
        type="password"
        minLength={8}
        maxLength={128}
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        required
      />
      {error ? <p className="error-message">{error}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Procesando…' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
      </button>
      <p>
        {isRegister ? '¿Ya tienes cuenta?' : '¿Necesitas una cuenta?'}{' '}
        <Link href={isRegister ? '/login' : '/register'}>
          {isRegister ? 'Inicia sesión' : 'Regístrate'}
        </Link>
      </p>
    </form>
  );
}
