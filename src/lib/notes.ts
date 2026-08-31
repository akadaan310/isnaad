'use client';
// ============================================================================
//  دفتر التدبّر — note storage.
//
//  Supabase when it is configured, localStorage otherwise. The studio is meant
//  to run the moment it is cloned, so the absence of credentials is a normal
//  operating mode and not a degraded one: the same interface backs both, and
//  nothing in the UI needs to know which is live.
// ============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TadabburNote } from './types';

const KEY = 'isnaad.tadabbur.v1';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
if (url && anon) {
  try {
    client = createClient(url, anon);
  } catch {
    client = null;
  }
}

export const notesBackend: 'supabase' | 'local' = client ? 'supabase' : 'local';

function readLocal(): TadabburNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TadabburNote[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(notes: TadabburNote[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* quota or a private window - the session simply is not persisted */
  }
}

/** Postgres columns are snake_case; the app is camelCase. */
interface NoteRow {
  id: string;
  surah: number;
  ayah: number;
  word_idx: number | null;
  body: string;
  tags: string[] | null;
  created_at: string;
  discovery_id: string | null;
}

const fromRow = (r: NoteRow): TadabburNote => ({
  id: r.id,
  surah: r.surah,
  ayah: r.ayah,
  wordIdx: r.word_idx ?? undefined,
  body: r.body,
  tags: r.tags ?? [],
  createdAt: r.created_at,
  discoveryId: r.discovery_id ?? undefined,
});

export async function listNotes(surah?: number): Promise<TadabburNote[]> {
  if (client) {
    let q = client.from('tadabbur_notes').select('*').order('created_at', { ascending: false });
    if (surah) q = q.eq('surah', surah);
    const { data, error } = await q;
    if (!error && data) return (data as NoteRow[]).map(fromRow);
    // Fall through to local storage rather than losing the pane to an error.
  }
  const all = readLocal();
  return surah ? all.filter((n) => n.surah === surah) : all;
}

export async function addNote(
  note: Omit<TadabburNote, 'id' | 'createdAt'>,
): Promise<TadabburNote> {
  const created: TadabburNote = {
    ...note,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `n${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  if (client) {
    const { error } = await client.from('tadabbur_notes').insert({
      id: created.id,
      surah: created.surah,
      ayah: created.ayah,
      word_idx: created.wordIdx ?? null,
      body: created.body,
      tags: created.tags,
      created_at: created.createdAt,
      discovery_id: created.discoveryId ?? null,
    });
    if (!error) return created;
  }
  writeLocal([created, ...readLocal()]);
  return created;
}

export async function removeNote(id: string): Promise<void> {
  if (client) {
    const { error } = await client.from('tadabbur_notes').delete().eq('id', id);
    if (!error) return;
  }
  writeLocal(readLocal().filter((n) => n.id !== id));
}
