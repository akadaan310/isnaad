'use client';
// ============================================================================
//  بطاقةُ الحبّة — the āyah you are standing on.
//
//  The field is the main view. Everything the engine knows about an āyah could
//  be listed here, and listing it turns the canvas into a backdrop behind a
//  document — which is the opposite of the point, since the geometry is where
//  the computation is supposed to become visible.
//
//  So the card opens at a glance: the āyah, its isnād mix as one bar, and a row
//  of counts. Each count is a door. Nothing else is shown until it is asked
//  for, and the whole card is capped well under half the viewport so the field
//  is never the smaller half.
// ============================================================================
import * as React from 'react';
import { Compass, Loader2, Radio, Scissors, Spline, Users } from 'lucide-react';
import type { CosmosNode } from '@/lib/cosmos';
import type { SelectedRibat, SelectedStrand } from '@/lib/cosmos/strands';
import { MODALITIES } from '@/lib/time-module';
import { arabicDecimal, arabicNumber, cn } from '@/lib/utils';
import { IsnadVector } from './isnad-vector';
import { StrandInspector } from './strand-panel';
import type { Derivation } from './use-strands';

type Pane = 'sanabil' | 'strands' | 'isnad' | 'cut' | null;

export function GrainCard({
  node,
  nodes,
  strands,
  ribat,
  derivation,
  visible,
  onPick,
}: {
  node: CosmosNode;
  nodes: CosmosNode[];
  strands: SelectedStrand[];
  ribat: SelectedRibat[];
  derivation: Derivation | null;
  /** Indices the time route admits, or null for the whole field. */
  visible: Set<number> | null;
  onPick: (i: number) => void;
}) {
  const [pane, setPane] = React.useState<Pane>(null);
  // A new āyah closes whatever was open: the reader moved, and the old pane
  // was about somewhere else.
  React.useEffect(() => setPane(null), [node.i]);

  const toggle = (p: Exclude<Pane, null>) => setPane((cur) => (cur === p ? null : p));
  const findings = derivation?.atAyah.length ?? 0;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 mx-auto max-w-3xl p-3">
      <div className="flex max-h-[46dvh] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a1018]/90 backdrop-blur-xl">
        {/* ── at a glance ── */}
        <div className="shrink-0 px-4 pb-2.5 pt-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6rem]">
            <span className="quran text-[1rem] text-gold">
              {node.name} · {arabicNumber(node.a)}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Compass className="h-2.5 w-2.5" />
              <span className="quran text-[0.85rem]">{node.conAr}</span>
            </span>
            <span className="font-mono tracking-widest text-muted-foreground/80">
              {node.sig || '—'}
            </span>
            {MODALITIES.map((m, k) =>
              node.tm[k] > 0 ? (
                <span
                  key={m.id}
                  title={m.gloss}
                  className="rounded border px-1 font-mono text-[0.5rem]"
                  style={{ borderColor: `${m.hue}55`, color: m.hue }}
                >
                  {m.code}
                </span>
              ) : null,
            )}
          </div>

          {/* The āyah itself scrolls rather than growing: a long one must not
              push the field off the screen. */}
          <div className="max-h-[8.5rem] overflow-y-auto thin-scroll">
            <p className="quran text-right text-[1.45rem] leading-[2] text-foreground/92">
              {node.text}
            </p>
          </div>

          <div className="mt-2">
            <IsnadVector v={node.v} distance={node.d} compact />
          </div>
        </div>

        {/* ── the doors ── */}
        <div className="flex shrink-0 flex-wrap gap-1 border-t border-white/[0.07] px-4 py-2">
          <Door
            on={pane === 'sanabil'}
            onClick={() => toggle('sanabil')}
            icon={<Radio className="h-3 w-3" />}
            hue="#C8A45C"
            count={node.sb.length}
          >
            السنابل
          </Door>
          <Door
            on={pane === 'strands'}
            onClick={() => toggle('strands')}
            icon={<Spline className="h-3 w-3" />}
            hue="#A78BFA"
            count={strands.length + ribat.length}
          >
            الخيوط
          </Door>
          <Door
            on={pane === 'cut'}
            onClick={() => toggle('cut')}
            icon={<Scissors className="h-3 w-3" />}
            hue="#6EE7B7"
            count={findings}
            busy={derivation?.pending}
          >
            الاستنباط
          </Door>
          <Door
            on={pane === 'isnad'}
            onClick={() => toggle('isnad')}
            icon={<Users className="h-3 w-3" />}
            hue="#D97706"
            label={arabicDecimal(node.d, 2)}
          >
            الإسناد
          </Door>
        </div>

        {/* ── whichever door was opened ── */}
        {pane && (
          <div className="min-h-0 flex-1 overflow-y-auto thin-scroll border-t border-white/[0.07] px-4 py-3">
            {pane === 'sanabil' && (
              <div className="flex flex-wrap gap-1">
                {node.sb.map((j, k) => {
                  const b = nodes[j];
                  if (!b) return null;
                  const dimmed = visible && !visible.has(j);
                  return (
                    <button
                      key={j}
                      onClick={() => onPick(j)}
                      title={b.text}
                      className={cn(
                        'group flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 transition-all hover:border-gold/40 hover:bg-gold/10',
                        dimmed && 'opacity-35',
                      )}
                    >
                      <span className="font-mono text-[0.5rem] text-gold/60">{k + 1}</span>
                      <span className="quran text-[0.9rem] text-foreground/80 group-hover:text-gold">
                        {b.name} {arabicNumber(b.a)}
                      </span>
                    </button>
                  );
                })}
                <p className="mt-1 w-full text-[0.5rem] leading-snug text-muted-foreground/60">
                  سبعٌ لكلِّ حبّة — طريقُ سيرٍ لا دعوى قرابة. لا تُتَّخذ دليلًا على تجمّع.
                </p>
              </div>
            )}

            {pane === 'strands' && (
              <>
                <p className="mb-1.5 text-[0.52rem] text-muted-foreground/70">
                  لكلِّ خيطٍ عِلّةٌ محسوبة، واتّباعُه يُغيّر موضعك.
                </p>
                <StrandInspector
                  strands={strands}
                  ribat={ribat}
                  focus={node.i}
                  nodes={nodes}
                  onPick={onPick}
                />
              </>
            )}

            {pane === 'isnad' && <IsnadVector v={node.v} distance={node.d} />}

            {pane === 'cut' && <CutPane derivation={derivation} />}
          </div>
        )}
      </div>
    </div>
  );
}

function CutPane({ derivation }: { derivation: Derivation | null }) {
  if (!derivation) {
    return (
      <p className="text-[0.56rem] text-muted-foreground/70">
        لم يُعَد الاستنباط بعد.
      </p>
    );
  }
  return (
    <>
      <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.55rem] text-[#6EE7B7]/80">
        استنباطُ هذه الآية عند الحدود الجارية
        <span className="font-mono text-[0.5rem] text-muted-foreground/70">
          أدنى درجة {arabicDecimal(derivation.options.minScore, 2)} · رباط{' '}
          {arabicNumber(derivation.options.stitchWindow)} · رجع{' '}
          {arabicNumber(derivation.options.echoWindow)}
        </span>
        {derivation.pending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      </p>
      {derivation.atAyah.length ? (
        <div className="space-y-1">
          {derivation.atAyah.map((d) => (
            <div key={d.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[0.58rem]">
                <span className="quran text-[0.85rem] text-foreground/85">{d.title}</span>
                <span className="font-mono text-[0.5rem] text-gold/80">
                  {arabicDecimal(d.score, 3)}
                </span>
              </p>
              <p className="mt-0.5 text-[0.56rem] leading-relaxed text-muted-foreground">{d.note}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[0.5rem] text-muted-foreground/65">
                {Object.entries(d.evidence).map(([k, v]) => (
                  <span key={k}>
                    <span className="text-muted-foreground/45">{k}</span>{' '}
                    {Array.isArray(v) ? v.join('، ') : String(v)}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[0.56rem] leading-snug text-muted-foreground/70">
          لا استنباطَ على هذه الآية عند هذه الحدود. اخفِض أدنى درجةٍ أو وسِّع النافذتين
          ليعيد المحرّك النظر.
        </p>
      )}
    </>
  );
}

function Door({
  children,
  onClick,
  on,
  icon,
  hue,
  count,
  label,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  on: boolean;
  icon: React.ReactNode;
  hue: string;
  count?: number;
  label?: string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.66rem] transition-colors',
        on ? 'bg-white/[0.08]' : 'border-white/10 bg-black/25 hover:bg-white/[0.05]',
      )}
      style={on ? { borderColor: `${hue}77`, color: hue } : undefined}
    >
      <span style={{ color: hue }}>{icon}</span>
      <span className="quran text-[0.85rem]">{children}</span>
      {busy ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
      ) : (
        <span className="font-mono text-[0.55rem] text-muted-foreground/70">
          {label ?? arabicNumber(count ?? 0)}
        </span>
      )}
    </button>
  );
}
