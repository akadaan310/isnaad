import { NextResponse } from 'next/server';
import {
  deleteComposition,
  getComposition,
  isSafeId,
  saveComposition,
} from '@/lib/compositions.server';
import type { Composition } from '@/lib/composition';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const c = await getComposition(params.id);
  if (!c) return NextResponse.json({ error: 'لا يوجد تأليفٌ بهذا المعرّف' }, { status: 404 });
  return NextResponse.json(c);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!isSafeId(params.id)) {
    return NextResponse.json({ error: 'معرّف غير صالح' }, { status: 400 });
  }
  let body: Composition;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'صيغة الطلب غير صالحة' }, { status: 400 });
  }
  const existing = await getComposition(params.id);
  if (!existing) return NextResponse.json({ error: 'لا يوجد تأليفٌ بهذا المعرّف' }, { status: 404 });

  // The path is authoritative for identity; createdAt is never rewritten.
  const merged: Composition = {
    ...existing,
    ...body,
    id: params.id,
    createdAt: existing.createdAt,
  };
  return NextResponse.json(await saveComposition(merged));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await deleteComposition(params.id);
  return NextResponse.json({ ok: true });
}
