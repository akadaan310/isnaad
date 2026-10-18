import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cached: string | null = null;

/** Computed relations over the full universe (see lib/universe/relations.ts). */
export async function GET() {
  try {
    cached ??= await readFile(path.join(process.cwd(), 'data', 'universe', 'relations.json'), 'utf8');
  } catch {
    return NextResponse.json({ error: 'لم تُبنَ الروابط بعد — شغّل npm run ingest:universe' }, { status: 503 });
  }
  return new NextResponse(cached, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}
