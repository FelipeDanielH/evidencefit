import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'evidencefit_session';

export async function requireAccessToken(): Promise<string> {
  const accessToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!accessToken) redirect('/login');
  return accessToken;
}
