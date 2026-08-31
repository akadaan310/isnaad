import 'server-only';
// ============================================================================
//  Composition storage.
//
//  Supabase when it is configured, a directory of JSON files otherwise. The
//  filesystem path is what makes the gallery work on a fresh clone with no
//  credentials; it is also why a serverless deployment wants Supabase, since
//  a read-only filesystem cannot accept a save. Both are behind one interface,
//  and `storageKind` reports which is live so the UI can say so plainly.
// ============================================================================
import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Composition } from './composition';

const DIR = path.join(process.cwd(), 'data', 'compositions');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let db: SupabaseClient | null = null;
if (url && key) {
  try {
    db = createClient(url, key, { auth: { persistSession: false } });
  } catch {
    db = null;
  }
}

export const storageKind: 'supabase' | 'files' = db ? 'supabase' : 'files';

/** Ids come from the URL, so they must never be able to escape the directory. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export function isSafeId(id: string): boolean {
  return SAFE_ID.test(id);
}

interface Row {
  id: string;
  data: Composition;
  published: boolean;
  updated_at: string;
}

async function ensureDir() {
  await mkdir(DIR, { recursive: true });
}

export async function listCompositions(onlyPublished: boolean): Promise<Composition[]> {
  if (db) {
    let q = db.from('compositions').select('*').order('updated_at', { ascending: false });
    if (onlyPublished) q = q.eq('published', true);
    const { data, error } = await q;
    if (!error && data) return (data as Row[]).map((r) => r.data);
  }

  await ensureDir();
  let names: string[];
  try {
    names = (await readdir(DIR)).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  const all = await Promise.all(
    names.map(async (n) => {
      try {
        return JSON.parse(await readFile(path.join(DIR, n), 'utf8')) as Composition;
      } catch {
        // A half-written or hand-edited file should not take down the gallery.
        return null;
      }
    }),
  );
  return all
    .filter((c): c is Composition => !!c && (!onlyPublished || c.published))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getComposition(id: string): Promise<Composition | null> {
  if (!isSafeId(id)) return null;
  if (db) {
    const { data, error } = await db.from('compositions').select('*').eq('id', id).maybeSingle();
    if (!error && data) return (data as Row).data;
  }
  try {
    return JSON.parse(await readFile(path.join(DIR, `${id}.json`), 'utf8')) as Composition;
  } catch {
    return null;
  }
}

export async function saveComposition(c: Composition): Promise<Composition> {
  if (!isSafeId(c.id)) throw new Error('معرّف التأليف غير صالح');
  const next: Composition = { ...c, updatedAt: new Date().toISOString() };

  if (db) {
    const { error } = await db.from('compositions').upsert({
      id: next.id,
      data: next,
      published: next.published,
      title: next.title,
      updated_at: next.updatedAt,
    });
    if (!error) return next;
  }
  await ensureDir();
  await writeFile(path.join(DIR, `${next.id}.json`), JSON.stringify(next, null, 2));
  return next;
}

export async function deleteComposition(id: string): Promise<void> {
  if (!isSafeId(id)) return;
  if (db) {
    const { error } = await db.from('compositions').delete().eq('id', id);
    if (!error) return;
  }
  try {
    await unlink(path.join(DIR, `${id}.json`));
  } catch {
    /* already gone */
  }
}
