import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { LogoutButton } from '../components/auth/logout-button';
import { SESSION_COOKIE } from '../lib/server-session';
import './styles.css';

export const metadata: Metadata = {
  title: 'EvidenceFit',
  description: 'Evaluación explicable de candidatos basada en evidencia.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isAuthenticated = (await cookies()).has(SESSION_COOKIE);
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link href="/">EvidenceFit</Link>
          <nav aria-label="Sesión">
            {isAuthenticated ? (
              <LogoutButton />
            ) : (
              <>
                <Link href="/login">Ingresar</Link>
                <Link href="/register">Crear cuenta</Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
