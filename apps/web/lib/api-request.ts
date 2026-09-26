function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(payload: unknown): string {
  if (isRecord(payload)) {
    if (typeof payload.message === 'string') return payload.message;
    if (
      Array.isArray(payload.message) &&
      payload.message.every((item) => typeof item === 'string')
    ) {
      return payload.message.join(' ');
    }
  }
  return 'La solicitud no pudo completarse.';
}

function getApiBase(accessToken: string | undefined): string {
  if (accessToken) {
    return process.env.API_URL ?? 'http://localhost:3001/api';
  }
  if (typeof window !== 'undefined') return '/api/backend';
  throw new Error('La sesión autenticada no está disponible.');
}

export async function apiRequest(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<unknown> {
  const response = await fetch(`${getApiBase(accessToken)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Keep a controlled error when an upstream response is not JSON.
  }
  if (!response.ok) throw new Error(getErrorMessage(payload));
  return payload;
}
