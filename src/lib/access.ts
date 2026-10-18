// ============================================================================
//  الخصوصية — who may open the studio. Pure, so it is tested, not trusted.
//
//  The studio is private by default. In development (`next dev`) it is open
//  to the machine it runs on. Anywhere else it refuses every request unless
//  either an access token is configured (and presented), or an operator has
//  written STUDIO_ALLOW_PUBLIC=1 — an explicit, greppable act, never a
//  default. The composer's "publish" and the gallery therefore reach only
//  people who already hold the token.
// ============================================================================

export interface AccessEnv {
  NODE_ENV?: string;
  STUDIO_ACCESS_TOKEN?: string;
  STUDIO_ALLOW_PUBLIC?: string;
}

export type AccessDecision =
  | { allow: true; reason: 'development' | 'token' | 'public-by-operator' }
  | { allow: false; status: 401 | 503; reason: 'no-credentials' | 'bad-credentials' | 'not-configured' };

/** Constant-time over the longer length, so a mismatch position leaks nothing. */
export function safeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** The secret a request presents: Bearer token, or the password of HTTP Basic. */
export function presented(authorization: string | null, decodeBase64: (s: string) => string): string | null {
  if (!authorization) return null;
  const [scheme, value] = authorization.split(/\s+/, 2);
  if (!value) return null;
  if (/^bearer$/i.test(scheme)) return value;
  if (/^basic$/i.test(scheme)) {
    try {
      const raw = decodeBase64(value);
      const i = raw.indexOf(':');
      return i >= 0 ? raw.slice(i + 1) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function decideAccess(env: AccessEnv, authorization: string | null, decodeBase64: (s: string) => string): AccessDecision {
  const token = env.STUDIO_ACCESS_TOKEN?.trim();
  if (token) {
    const got = presented(authorization, decodeBase64);
    if (got === null) return { allow: false, status: 401, reason: 'no-credentials' };
    return safeEqual(got, token) ? { allow: true, reason: 'token' } : { allow: false, status: 401, reason: 'bad-credentials' };
  }
  if (env.NODE_ENV !== 'production') return { allow: true, reason: 'development' };
  if (env.STUDIO_ALLOW_PUBLIC === '1') return { allow: true, reason: 'public-by-operator' };
  return { allow: false, status: 503, reason: 'not-configured' };
}
