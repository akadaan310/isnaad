import { NextResponse } from 'next/server';
import { listCompositions, saveComposition, storageKind } from '@/lib/compositions.server';
import { emptyComposition, newId, type Composition } from '@/lib/composition';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const onlyPublished = url.searchParams.get('published') === '1';
  const items = await listCompositions(onlyPublished);
  return NextResponse.json({ storage: storageKind, items });
}

export async function POST(req: Request) {
  let incoming: Partial<Composition> = {};
  try {
    incoming = await req.json();
  } catch {
    /* an empty body means "give me a blank one" */
  }
  const created: Composition = {
    ...emptyComposition(newId()),
    ...incoming,
    // The id and timestamps are the server's to set, never the client's.
    id: newId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(await saveComposition(created), { status: 201 });
}
