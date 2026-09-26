'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button className="link-button" type="button" onClick={logout}>
      Cerrar sesión
    </button>
  );
}
