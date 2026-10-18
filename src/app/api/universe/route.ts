import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cached: string | null = null;

/** All 6,236 āyāt, columnar. Private: never cached by shared intermediaries. */
export async function GET() {
  try {
    cached ??= await readFile(path.join(process.cwd(), 'data', 'universe', 'universe.json'), 'utf8');
  } catch {
    return NextResponse.json({ error: 'لم يُبنَ الكون الكامل بعد — شغّل npm run ingest:universe' }, { status: 503 });
  }
  return new NextResponse(cached, {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
}
