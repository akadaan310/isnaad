import { NextResponse } from 'next/server';
import { assembleMovement, DEFAULT_ASSEMBLE } from '@/lib/engine/assembler';

export const dynamic = 'force-dynamic';

/** Pack a برج around one عَلَم. The result is a starting point, then edited. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const alam = url.searchParams.get('alam');
  if (!alam) return NextResponse.json({ error: 'يلزم تحديد العَلَم' }, { status: 400 });

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || DEFAULT_ASSEMBLE.limit, 1), 40);
  const interleave = url.searchParams.get('interleave') !== '0';
  const includeAssociated = url.searchParams.get('associated') !== '0';

  const movement = await assembleMovement(alam, { limit, interleave, includeAssociated });
  if (!movement) return NextResponse.json({ error: 'عَلَمٌ غير معروف' }, { status: 404 });
  return NextResponse.json(movement);
}
