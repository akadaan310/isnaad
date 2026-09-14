'use client';
// ============================================================================
//  متجه الإسناد — all three components, not the argmax.
//
//  The field paints a node by `dominant(v)`, which keeps the largest of the
//  three shares and discards the rest. An āyah at [0.34, 0.33, 0.33] and one at
//  [1, 0, 0] come out the same colour. The vector has been on the client since
//  the first frame; nothing here computes it, and the colour encoding is
//  untouched — this reads the two components the paint throws away.
//
//  It also carries the disclaimer, because the colour invites a reading it
//  cannot support. Dominance is a mass count over segments in the attribution
//  chair. Who *speaks* an āyah is a different computation entirely — `frames.ts`
//  resolves it from a verb of saying, labels an inferred speaker مستنبَط, and
//  is not reachable from this canvas at all.
// ============================================================================
import * as React from 'react';
import type { Person } from '@/lib/types';
import { PERSON_STYLE } from '@/lib/view';
import { arabicDecimal, arabicNumber } from '@/lib/utils';

const ORDER: Person[] = [1, 2, 3];

export function IsnadVector({
  v,
  distance,
  compact = false,
}: {
  /** node.v — the share of attribution seated at each person. */
  v: [number, number, number];
  /** node.d — the weighted mean of those shares on the proximity axis. */
  distance: number;
  /**
   * The bar and its three numbers only. The field is the main view, so the
   * reading of an āyah opens small and is expanded on request — a panel that
   * covers the canvas has stopped being a reading of it.
   */
  compact?: boolean;
}) {
  const mass = v[0] + v[1] + v[2];
  const share = (p: Person) => (mass > 0 ? v[p - 1] / mass : 0);
  const top = mass > 0 ? Math.max(v[0], v[1], v[2]) : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          {mass > 0 &&
            ORDER.map((p) =>
              share(p) > 0 ? (
                <div
                  key={p}
                  style={{ width: `${share(p) * 100}%`, background: PERSON_STYLE[p].hex }}
                  title={`${PERSON_STYLE[p].label} — ${arabicDecimal(share(p), 2)}`}
                />
              ) : null,
            )}
        </div>
        <span className="flex shrink-0 items-baseline gap-2 font-mono text-[0.52rem]">
          {ORDER.map((p) => (
            <span key={p} style={{ color: PERSON_STYLE[p].hex, opacity: share(p) > 0 ? 1 : 0.35 }}>
              {arabicDecimal(share(p), 2)}
            </span>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-[0.58rem] text-gold/70">
        متجهُ الإسناد — نصيبُ كلِّ مقامٍ من مقعد الإسناد
      </p>

      {mass > 0 ? (
        <>
          {/* One bar, three segments. The bar is the mix; the node's colour is
              only its largest part. */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            {ORDER.map((p) =>
              share(p) > 0 ? (
                <div
                  key={p}
                  style={{ width: `${share(p) * 100}%`, background: PERSON_STYLE[p].hex }}
                  title={`${PERSON_STYLE[p].label} — ${arabicDecimal(share(p), 2)}`}
                />
              ) : null,
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {ORDER.map((p) => (
              <span key={p} className="flex items-baseline gap-1 text-[0.56rem]">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: PERSON_STYLE[p].hex, opacity: share(p) > 0 ? 1 : 0.3 }}
                />
                <span className="quran text-[0.82rem]" style={{ color: PERSON_STYLE[p].hex }}>
                  {PERSON_STYLE[p].label}
                </span>
                <span className="font-mono text-muted-foreground">
                  {arabicDecimal(share(p), 2)}
                </span>
              </span>
            ))}
            <span className="text-[0.52rem] text-muted-foreground/60">
              الكتلة {arabicDecimal(mass, 1)} · المسافة {arabicDecimal(distance, 2)}
            </span>
          </div>

          {/* When the top share is slight, the colour is a near-tie being
              rendered as a verdict. Say so rather than let the paint assert it. */}
          {top / mass < 0.5 && (
            <p className="mt-1 text-[0.5rem] leading-snug text-muted-foreground/70">
              لا يبلغ أعلى النصيبَين نصفَ الكتلة، فلونُ الحبّة ترجيحٌ ضعيف
              ({arabicNumber(Math.round((top / mass) * 100))}٪) لا غلبةٌ بيّنة.
            </p>
          )}
        </>
      ) : (
        <p className="text-[0.56rem] text-muted-foreground/70">
          لا إسنادَ محسوبًا في هذه الآية — لا كلمةَ فيها تجلس في مقعد الإسناد.
        </p>
      )}

      <p className="mt-1.5 text-[0.5rem] leading-snug text-muted-foreground/60">
        الغلبةُ عَدُّ كتلةٍ على المقاطع، لا نسبةُ قولٍ. القائلُ يُستخرج من أطر القول
        <span className="text-muted-foreground/45"> (frames.ts)</span> ولا يُعرض في هذا الحقل.
      </p>
    </div>
  );
}
