import { NextResponse } from 'next/server';
import { getTopDiscoveries } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 500);

  let items = await getTopDiscoveries();
  if (kind && kind !== 'all') items = items.filter((d) => d.kind === kind);
  return NextResponse.json(items.slice(0, limit));
}
