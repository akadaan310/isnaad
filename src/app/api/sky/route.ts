import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cached: string | null = null;

/** The whole naked-eye sky, read once per server process. */
export async function GET() {
  try {
    cached ??= await readFile(path.join(process.cwd(), 'data', 'sky', 'sky.json'), 'utf8');
  } catch {
    return NextResponse.json(
      { error: 'لم تُبنَ بيانات السماء بعد — شغّل npm run ingest:sky' },
      { status: 503 },
    );
  }
  return new NextResponse(cached, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=86400, immutable',
    },
  });
}
