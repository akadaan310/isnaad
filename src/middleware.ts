import { NextResponse, type NextRequest } from 'next/server';
import { decideAccess } from '@/lib/access';

/**
 * Every route, API included, passes through here. See lib/access.ts for the
 * rule and docs/studio/PRIVACY.md for how to deploy behind it.
 */
export function middleware(req: NextRequest) {
  const d = decideAccess(
    {
      NODE_ENV: process.env.NODE_ENV,
      STUDIO_ACCESS_TOKEN: process.env.STUDIO_ACCESS_TOKEN,
      STUDIO_ALLOW_PUBLIC: process.env.STUDIO_ALLOW_PUBLIC,
    },
    req.headers.get('authorization'),
    (s) => atob(s),
  );
  if (!d.allow) {
    const body =
      d.status === 503
        ? 'استوديو خاص: لم يُضبط رمز الوصول. اضبط STUDIO_ACCESS_TOKEN (انظر docs/studio/PRIVACY.md).'
        : 'استوديو خاص: يلزم رمز الوصول.';
    return new NextResponse(body, {
      status: d.status,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
        ...(d.status === 401 ? { 'www-authenticate': 'Basic realm="isnaad-studio", charset="UTF-8"' } : {}),
      },
    });
  }
  const res = NextResponse.next();
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  res.headers.set('referrer-policy', 'no-referrer');
  res.headers.set('x-content-type-options', 'nosniff');
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
