// ============================================================================
//  /api/cosmos/strands — the engine's relations, joined to placed āyāt.
//
//  Built here rather than in the browser because it needs the mined indices
//  (2.3 MB of motifs, roots and discoveries) and the answer does not depend on
//  the request: one build per server process, then a string.
//
//  السنابل are deliberately *not* on the wire. Every node already carries its
//  seven branches, so the client rebuilds those 7,000 strands locally for free.
// ============================================================================
import { NextResponse } from 'next/server';
import { getCosmos, getMotifs, getRootIndex, getTopDiscoveries } from '@/lib/data.server';
import { buildLocusJoin } from '@/lib/cosmos/locus';
import { discoveryStrands, motifStrands, ribatVectors, rootStrands } from '@/lib/cosmos/strands';
import { packStrands } from '@/lib/cosmos/wire';

export const dynamic = 'force-dynamic';

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    let built;
    try {
      built = await Promise.all([getCosmos(), getMotifs(), getRootIndex(), getTopDiscoveries()]);
    } catch {
      return NextResponse.json(
        { error: 'لم يُبنَ الكون بعد — شغّل npm run ingest:cosmos' },
        { status: 503 },
      );
    }
    const [cosmos, motifs, roots, discoveries] = built;
    const join = buildLocusJoin(cosmos.nodes);
    cached = JSON.stringify({
      ...packStrands([
        ...motifStrands(motifs, join),
        ...rootStrands(roots, join),
        ...discoveryStrands(discoveries, join),
      ]),
      ribat: ribatVectors(discoveries, join),
    });
  }
  return new NextResponse(cached, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}
