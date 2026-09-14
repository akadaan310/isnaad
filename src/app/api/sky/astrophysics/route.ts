// ============================================================================
//  /api/sky/astrophysics — the fitted laws, not the catalogue.
//
//  Nine kilobytes standing in for 900,000 Gaia DR3 rows. The client generates
//  populations from these; it never receives a star it did not make.
// ============================================================================
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cached: string | null = null;

export async function GET() {
  try {
    cached ??= await readFile(path.join(process.cwd(), 'data', 'sky', 'astrophysics.json'), 'utf8');
  } catch {
    return NextResponse.json(
      { error: 'لم تُقَس القوانين بعد — شغّل npm run ingest:gaia' },
      { status: 503 },
    );
  }
  return new NextResponse(cached, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
  });
}
