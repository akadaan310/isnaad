// ============================================================================
//  مذكّرات البحث — notes that keep their source.
//
//  A note is attached to a locus and carries, frozen at the moment it was
//  written, the Arabic it is about and which layer each statement came from:
//  the text itself, a mechanical extraction, or the reader's own reading. The
//  export keeps those three apart so a note can never present an
//  interpretation as if the engine had found it.
// ============================================================================

export type Provenance = 'نص' | 'استنباط آلي' | 'قراءة';

export interface ResearchNote {
  id: string;
  surah: number;
  ayah: number;
  /** Uthmani text of the āyah, as served by /api/universe/ayah when written. */
  text: string;
  /** Mechanical facts shown in the inspector when the note was written. */
  extracted: string[];
  /** The reader's own words. Always labelled قراءة. */
  body: string;
  createdAt: string;
}

export function notesToMarkdown(notes: readonly ResearchNote[], title = 'مذكّرات البحث'): string {
  const out: string[] = [`# ${title}`, '', `> كلّ بندٍ موسومٌ بمصدره: **نص** (المصحف)، **استنباط آلي** (المحرّك)، **قراءة** (القارئ).`, ''];
  for (const n of [...notes].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.createdAt.localeCompare(b.createdAt))) {
    out.push(`## ${n.surah}:${n.ayah}`, '');
    out.push(`- **نص**: ${n.text}`);
    for (const e of n.extracted) out.push(`- **استنباط آلي**: ${e}`);
    if (n.body.trim()) out.push(`- **قراءة**: ${n.body.trim()}`);
    out.push(`- _${n.createdAt}_`, '');
  }
  return out.join('\n');
}

export function parseNotes(raw: string | null): ResearchNote[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (n): n is ResearchNote =>
        !!n && typeof n === 'object' && typeof (n as ResearchNote).surah === 'number' && typeof (n as ResearchNote).ayah === 'number',
    );
  } catch {
    return [];
  }
}
