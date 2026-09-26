import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'evidencefit_session';

export function proxy(request: NextRequest): NextResponse {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/jobs/:path*', '/candidates/:path*', '/evaluations/:path*'],
};
