// ============================================================================
//  /api/cosmos/basis — the spectral directions.
//
//  isnād and contour bases are O(n) and are built in the browser. This one is
//  not: it needs the leading eigenvectors of a 1,000 × 1,000 normalised
//  adjacency, which is around half a billion multiply-adds. Once per server
//  process, then a string.
// ============================================================================
import { NextResponse } from 'next/server';
import { getCosmos, getMotifs, getRootIndex, getTopDiscoveries } from '@/lib/data.server';
import { buildLocusJoin } from '@/lib/cosmos/locus';
import { discoveryStrands, motifStrands, rootStrands, sunbulaStrands } from '@/lib/cosmos/strands';
import { measureBasis, spectralBasis } from '@/lib/cosmos/basis';

export const dynamic = 'force-dynamic';

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    let built;
    try {
      built = await Promise.all([getCosmos(), getMotifs(), getRootIndex(), getTopDiscoveries()]);
    } catch {
      return NextResponse.json({ error: 'لم يُبنَ الكون بعد' }, { status: 503 });
    }
    const [cosmos, motifs, roots, discoveries] = built;
    const join = buildLocusJoin(cosmos.nodes);
    const strands = [
      ...sunbulaStrands(cosmos.nodes),
      ...motifStrands(motifs, join),
      ...rootStrands(roots, join),
      ...discoveryStrands(discoveries, join),
    ];
    const basis = spectralBasis(cosmos.nodes, strands);
    const report = measureBasis(cosmos.nodes, strands, basis);
    cached = JSON.stringify({
      // Rounded: three decimals on a unit vector is finer than a pixel here,
      // and halves the payload.
      directions: basis.directions.map((d) => d.map((x) => Math.round(x * 1e3) / 1e3)),
      note: basis.note,
      locality: report.locality,
      convergences: report.convergences,
    });
  }
  return new NextResponse(cached, {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}
