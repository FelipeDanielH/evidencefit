import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/server-session';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: 'Debes iniciar sesión.' }, { status: 401 });
  }

  const { path } = await context.params;
  const apiBase = process.env.API_URL ?? 'http://localhost:3001/api';
  const upstreamUrl = new URL(`${apiBase}/${path.map(encodeURIComponent).join('/')}`);
  upstreamUrl.search = request.nextUrl.search;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(upstreamUrl, {
    body: hasBody ? await request.arrayBuffer() : undefined,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(request.headers.get('content-type')
        ? { 'Content-Type': request.headers.get('content-type') ?? 'application/json' }
        : {}),
    },
    method: request.method,
    redirect: 'manual',
  });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
    status: upstream.status,
  });
}

export const GET = forward;
export const POST = forward;
