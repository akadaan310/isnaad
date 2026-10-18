import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Counts, file hashes and the legacy-preset check, as the ingest wrote them. */
export async function GET() {
  try {
    const body = await readFile(path.join(process.cwd(), 'data', 'universe', 'manifest.json'), 'utf8');
    return new NextResponse(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });
  } catch {
    return NextResponse.json({ error: 'لا يوجد بيان — شغّل npm run ingest:universe' }, { status: 503 });
  }
}
