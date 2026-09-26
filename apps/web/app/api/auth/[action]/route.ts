import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/server-session';

interface AuthPayload {
  accessToken: string;
}

interface RouteContext {
  params: Promise<{ action: string }>;
}

function isAuthPayload(value: unknown): value is AuthPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accessToken' in value &&
    typeof value.accessToken === 'string'
  );
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { action } = await context.params;
  if (action === 'logout') {
    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  if (action !== 'login' && action !== 'register') {
    return NextResponse.json({ message: 'Ruta de autenticación inválida.' }, { status: 404 });
  }

  const apiBase = process.env.API_URL ?? 'http://localhost:3001/api';
  const upstream = await fetch(`${apiBase}/auth/${action}`, {
    body: await request.text(),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok || !isAuthPayload(payload)) {
    return NextResponse.json(payload ?? { message: 'La autenticación no está disponible.' }, {
      status: upstream.ok ? 502 : upstream.status,
    });
  }

  const response = NextResponse.json({ success: true }, { status: upstream.status });
  const maxAge = Number(process.env.JWT_EXPIRES_IN_SECONDS ?? '3600');
  response.cookies.set(SESSION_COOKIE, payload.accessToken, {
    httpOnly: true,
    maxAge: Number.isFinite(maxAge) ? maxAge : 3600,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
