// ============================================================================
//  التسليم — a private, explicit handoff from one reader to another.
//
//  Abed chooses what to send; nothing is sent on its own. A handoff is a small
//  JSON document — a locus, a lens, a voyage code, a camera pose, a note — that
//  can travel three ways, all of them user-initiated:
//
//    fragment   #h=<base64url> on the studio's own URL. A URL fragment is never
//               sent to any server by the browser, so the link carries the state
//               without the app's host ever seeing it.
//    file       a downloaded .json the user attaches wherever they like.
//    PURL       optionally published to a capability-scoped PURL resource, only
//               through the adapter in purl.ts and only with a token the user
//               supplies. Never automatic.
//
//  What a handoff does not do, stated in the document itself so the recipient
//  reads it too: it gives no one live access to the app, it does not let any
//  external chat assistant "see" the session, and it contains no private notes
//  unless the user typed them into `note`.
// ============================================================================
import { digestOf } from './rng';

export type Lens = 'isnad' | 'celestial' | 'composite';

export interface HandoffState {
  format: 'isnaad-handoff/1';
  /** Ordinal and the human locus, both — the ordinal is checked against it. */
  locus: { k: number; surah: number; ayah: number } | null;
  lens: Lens;
  /** encodeVoyageConfig(...) output, if a voyage is attached. */
  voyage: string | null;
  /** Camera position and look target in the lens's own space. */
  camera: { p: [number, number, number]; look: [number, number, number] } | null;
  note: string;
  from: string;
  to: string;
  createdAt: string;
  access: string;
  digest?: string;
}

export const ACCESS_STATEMENT =
  'هذا تسليمٌ ساكن: يحمل موضعًا وحالةَ رحلة فقط. لا يمنح وصولًا حيًّا إلى التطبيق، ولا يجعل أيَّ مساعدٍ خارجيّ يرى الجلسة، ولا يُرسَل إلى أي خادم إلا إذا نشرتَه أنت.';

export function makeHandoff(x: Omit<HandoffState, 'format' | 'access' | 'digest' | 'createdAt'> & { createdAt?: string }): HandoffState {
  const h: HandoffState = {
    format: 'isnaad-handoff/1',
    locus: x.locus,
    lens: x.lens,
    voyage: x.voyage,
    camera: x.camera
      ? {
          p: x.camera.p.map((c) => +c.toFixed(3)) as [number, number, number],
          look: x.camera.look.map((c) => +c.toFixed(3)) as [number, number, number],
        }
      : null,
    note: x.note.slice(0, 2000),
    from: x.from.slice(0, 40),
    to: x.to.slice(0, 40),
    createdAt: x.createdAt ?? new Date().toISOString(),
    access: ACCESS_STATEMENT,
  };
  h.digest = digestOf({ ...h, digest: undefined });
  return h;
}

// base64url over UTF-8, with no dependency on Buffer or btoa availability.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toB64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromB64url(s: string): Uint8Array | null {
  const vals: number[] = [];
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    vals.push(v);
  }
  const out: number[] = [];
  for (let i = 0; i < vals.length; i += 4) {
    const n = (vals[i] << 18) | ((vals[i + 1] ?? 0) << 12) | ((vals[i + 2] ?? 0) << 6) | (vals[i + 3] ?? 0);
    out.push((n >> 16) & 255);
    if (i + 2 < vals.length) out.push((n >> 8) & 255);
    if (i + 3 < vals.length) out.push(n & 255);
  }
  return new Uint8Array(out);
}

export function encodeHandoff(h: HandoffState): string {
  return toB64url(new TextEncoder().encode(JSON.stringify(h)));
}

export type DecodeResult = { ok: true; handoff: HandoffState } | { ok: false; reason: string };

/** Decode and verify. A handoff whose digest does not match is refused, not repaired. */
export function decodeHandoff(code: string, ordinalOf?: (s: number, a: number) => number | undefined): DecodeResult {
  if (code.length > 16000) return { ok: false, reason: 'too long' };
  const bytes = fromB64url(code);
  if (!bytes) return { ok: false, reason: 'not base64url' };
  let h: HandoffState;
  try {
    h = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as HandoffState;
  } catch {
    return { ok: false, reason: 'not JSON' };
  }
  if (h?.format !== 'isnaad-handoff/1') return { ok: false, reason: 'unknown format' };
  if (h.digest !== digestOf({ ...h, digest: undefined })) return { ok: false, reason: 'digest mismatch' };
  if (!['isnad', 'celestial', 'composite'].includes(h.lens)) return { ok: false, reason: 'unknown lens' };
  if (h.locus && ordinalOf && ordinalOf(h.locus.surah, h.locus.ayah) !== h.locus.k) {
    return { ok: false, reason: 'locus does not match ordinal' };
  }
  return { ok: true, handoff: h };
}
