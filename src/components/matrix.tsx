'use client';
// ============================================================================
//  Pane 3 — مصفوفة التدبّر الإسنادي.
//
//  Five readings of the active sūrah: its isnād vector, what the detectors
//  found in it, which āyāt elsewhere carry the same contour, the tree of who
//  is quoting whom, and the chamber walk.
// ============================================================================
import * as React from 'react';
import {
  Sparkles, GitBranch, Compass, Hourglass, NotebookPen, Trash2, Plus,
  ArrowLeftRight, Clock, ChevronLeft, Loader2, Database, HardDrive,
} from 'lucide-react';
import type { Discovery, Motif, Surah, TadabburNote, TarteelStation } from '@/lib/types';
import type { Frame } from '@/lib/engine/frames';
import type { Resonance } from '@/lib/engine/graph';
import { DISCOVERY_STYLE, PERSON_STYLE } from '@/lib/view';
import { addNote, listNotes, notesBackend, removeNote } from '@/lib/notes';
import { arabicNumber, cn, pct } from '@/lib/utils';
import { Badge, Button, Empty, Panel, Tabs } from './ui';
import { MiniContour } from './waveform';

export type MatrixTab = 'tadabbur' | 'discoveries' | 'mathani' | 'tree' | 'chamber';

export interface MatrixProps {
  surah: Surah;
  discoveries: Discovery[];
  frames: Frame[];
  activeAyah: number;
  tab: MatrixTab;
  setTab: (t: MatrixTab) => void;
  onFocusDiscovery: (d: Discovery) => void;
  onOpenAyah: (surah: number, ayah: number) => void;
  onCompare: (surah: number, ayah: number) => void;
  selectedDiscovery: string | null;
}

export function Matrix(props: MatrixProps) {
  const { surah, discoveries, tab, setTab } = props;
  return (
    <div className="flex h-full flex-col gap-3">
      <Tabs<MatrixTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'tadabbur', label: 'التدبّر', icon: <NotebookPen className="h-3 w-3" /> },
          { id: 'discoveries', label: 'الكشف', icon: <Sparkles className="h-3 w-3" />, count: discoveries.length },
          { id: 'mathani', label: 'المثاني', icon: <ArrowLeftRight className="h-3 w-3" /> },
          { id: 'tree', label: 'الطبقات', icon: <GitBranch className="h-3 w-3" /> },
          { id: 'chamber', label: 'الحجرة', icon: <Hourglass className="h-3 w-3" /> },
        ]}
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto thin-scroll -mx-1 px-1">
        {tab === 'tadabbur' && <TadabburPanel {...props} />}
        {tab === 'discoveries' && <DiscoveriesPanel {...props} />}
        {tab === 'mathani' && <MathaniPanel {...props} />}
        {tab === 'tree' && <TreePanel {...props} />}
        {tab === 'chamber' && <ChamberPanel {...props} />}
        <p className="px-1 pb-2 text-center text-[0.58rem] leading-relaxed text-muted-foreground/70">
          كل ما يعرضه المرصد استنباطٌ آليٌّ من الوسم الصرفي — يدلّ على موضع النظر، ولا يقوم مقام التفسير.
        </p>
      </div>
    </div>
  );
}

// ── التدبّر ─────────────────────────────────────────────────────────────────
function TadabburPanel({ surah, activeAyah, onFocusDiscovery: _f }: MatrixProps) {
  const ayah = surah.ayaat.find((a) => a.n === activeAyah) ?? surah.ayaat[0];
  const [notes, setNotes] = React.useState<TadabburNote[]>([]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void listNotes(surah.id).then(setNotes);
  }, [surah.id]);

  const save = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const n = await addNote({ surah: surah.id, ayah: activeAyah, body, tags: [] });
    setNotes((cur) => [n, ...cur]);
    setDraft('');
    setBusy(false);
  };

  const drop = async (id: string) => {
    await removeNote(id);
    setNotes((cur) => cur.filter((n) => n.id !== id));
  };

  return (
    <>
      <Panel title="متجه الإسناد" icon={<Compass className="h-3.5 w-3.5" />}>
        <VectorBars vec={ayah?.vec ?? surah.vec} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-[0.68rem]">
          <Stat label="مسافة الخطاب" value={pct(ayah?.distance ?? surah.distance)} hint="٠٪ مناجاة · ١٠٠٪ غيبة" />
          <Stat label="كنتور الآية" value={ayah?.sig || '—'} mono hint="تعاقب مقاعد الإسناد" />
          <Stat label="قوّة الجسر" value={pct(ayah?.clock.bridge ?? 0)} hint="اجتماع الماضي والمضارع" />
          <Stat label="طبقات القول" value={arabicNumber(surah.maxDepth)} hint="أعمق تداخلٍ في السورة" />
        </div>
      </Panel>

      <Panel title="ساعة الآية" icon={<Clock className="h-3.5 w-3.5" />}>
        <ClockDial clock={ayah?.clock} />
      </Panel>

      <Panel
        title="دفتر التدبّر"
        icon={<NotebookPen className="h-3.5 w-3.5" />}
        action={
          <Badge tone="neutral">
            {notesBackend === 'supabase' ? (
              <><Database className="h-2.5 w-2.5" />Supabase</>
            ) : (
              <><HardDrive className="h-2.5 w-2.5" />محفوظ محليًّا</>
            )}
          </Badge>
        }
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
          }}
          rows={3}
          placeholder={`ما الذي رأيتَه في الآية ${arabicNumber(activeAyah)}؟`}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[0.75rem] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-gold/40"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[0.6rem] text-muted-foreground">
            على الآية {arabicNumber(activeAyah)} · ⌘↵ للحفظ
          </span>
          <Button size="xs" variant="gold" onClick={save} disabled={busy || !draft.trim()}>
            <Plus className="h-3 w-3" />
            قيِّد
          </Button>
        </div>

        <div className="mt-3 space-y-1.5">
          {notes.map((n) => (
            <div key={n.id} className="group rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
              <div className="mb-1 flex items-center justify-between">
                <Badge tone="gold">آية {arabicNumber(n.ayah)}</Badge>
                <button
                  onClick={() => drop(n.id)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[0.74rem] leading-relaxed text-foreground/85">{n.body}</p>
            </div>
          ))}
          {!notes.length && <Empty>لم تُقيَّد بعدُ ملاحظةٌ في هذه السورة.</Empty>}
        </div>
      </Panel>
    </>
  );
}

function Stat({ label, value, hint, mono }: { label: string; value: string; hint?: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2" title={hint}>
      <p className="text-[0.6rem] text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-semibold text-foreground/90', mono && 'font-mono tracking-widest')}>{value}</p>
    </div>
  );
}

function VectorBars({ vec }: { vec: { p1: number; p2: number; p3: number } }) {
  const rows = [
    { p: 1 as const, v: vec.p1 },
    { p: 2 as const, v: vec.p2 },
    { p: 3 as const, v: vec.p3 },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map(({ p, v }) => (
        <div key={p} className="flex items-center gap-2" title={PERSON_STYLE[p].gloss}>
          <span className="w-11 shrink-0 text-[0.68rem]" style={{ color: PERSON_STYLE[p].soft }}>
            {PERSON_STYLE[p].label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${v * 100}%`, background: PERSON_STYLE[p].hex }}
            />
          </div>
          <span className="w-8 shrink-0 text-left text-[0.62rem] tabular-nums text-muted-foreground">
            {pct(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ClockDial({ clock }: { clock?: { past: number; present: number; imperative: number; timeNouns: number; bridge: number } }) {
  if (!clock) return <Empty>—</Empty>;
  const rows = [
    { label: 'ماضٍ', v: clock.past, hex: '#64748B' },
    { label: 'مضارع', v: clock.present, hex: '#C8A45C' },
    { label: 'أمر', v: clock.imperative, hex: '#059669' },
    { label: 'ألفاظ الزمن', v: clock.timeNouns, hex: '#0284C7' },
  ];
  return (
    <>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[0.66rem] text-muted-foreground">{r.label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
              <div className="h-full" style={{ width: `${Math.min(1, r.v * 3) * 100}%`, background: r.hex }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.62rem] leading-relaxed text-muted-foreground">
        الجسر يشتدّ حين يجتمع سردٌ ماضٍ ومضارعٌ حيٌّ في نفَسٍ واحد، فينزل الخبر في زمن القارئ.
      </p>
    </>
  );
}

// ── الكشف ───────────────────────────────────────────────────────────────────
function DiscoveriesPanel({ discoveries, onFocusDiscovery, selectedDiscovery }: MatrixProps) {
  const [kind, setKind] = React.useState<string>('all');

  const kinds = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of discoveries) c[d.kind] = (c[d.kind] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [discoveries]);

  const shown = React.useMemo(
    () => (kind === 'all' ? discoveries : discoveries.filter((d) => d.kind === kind)).slice(0, 90),
    [discoveries, kind],
  );

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setKind('all')}
          className={cn(
            'rounded-full border px-2 py-0.5 text-[0.64rem] transition-colors',
            kind === 'all' ? 'border-gold/50 bg-gold/15 text-gold' : 'border-white/10 text-muted-foreground hover:text-foreground',
          )}
        >
          الكل {arabicNumber(discoveries.length)}
        </button>
        {kinds.map(([k, n]) => {
          const st = DISCOVERY_STYLE[k as keyof typeof DISCOVERY_STYLE];
          const on = kind === k;
          return (
            <button
              key={k}
              title={st?.hint}
              onClick={() => setKind(k)}
              className="rounded-full border px-2 py-0.5 text-[0.64rem] transition-colors"
              style={
                on
                  ? { borderColor: `${st.hex}88`, background: `${st.hex}22`, color: st.hex }
                  : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgb(148 163 184)' }
              }
            >
              {st?.short ?? k} {arabicNumber(n)}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        {shown.map((d) => (
          <DiscoveryCard
            key={d.id}
            d={d}
            active={selectedDiscovery === d.id}
            onClick={() => onFocusDiscovery(d)}
          />
        ))}
        {!shown.length && <Empty>لم يقع في هذه السورة كشفٌ من هذا الصنف.</Empty>}
      </div>
    </>
  );
}

function DiscoveryCard({ d, active, onClick }: { d: Discovery; active: boolean; onClick: () => void }) {
  const st = DISCOVERY_STYLE[d.kind];
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-2 text-right transition-all',
        active ? 'bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]',
      )}
      style={active ? { borderColor: `${st.hex}88` } : undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold" style={{ color: st.hex }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.hex }} />
          {d.title}
        </span>
        <span className="shrink-0 text-[0.6rem] tabular-nums text-muted-foreground">
          {d.ayahFrom === d.ayahTo
            ? `آية ${arabicNumber(d.ayahFrom)}`
            : `${arabicNumber(d.ayahFrom)}–${arabicNumber(d.ayahTo)}`}
        </span>
      </div>
      <p className="text-[0.7rem] leading-relaxed text-foreground/70">{d.note}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full" style={{ width: `${d.score * 100}%`, background: st.hex }} />
        </div>
        <span className="text-[0.58rem] tabular-nums text-muted-foreground">
          {arabicNumber(Math.round(d.score * 100))}٪
        </span>
      </div>
    </button>
  );
}

// ── المثاني ─────────────────────────────────────────────────────────────────
function MathaniPanel({ surah, activeAyah, onOpenAyah, onCompare }: MatrixProps) {
  const [res, setRes] = React.useState<{ anchor: { sig: string }; matches: (Resonance & { name: string; text: string })[] } | null>(null);
  const [motifs, setMotifs] = React.useState<Motif[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    void Promise.all([
      fetch(`/api/resonance?surah=${surah.id}&ayah=${activeAyah}&limit=18`).then((r) => r.json()),
      fetch(`/api/motifs?surah=${surah.id}&limit=14`).then((r) => r.json()),
    ]).then(([r, m]) => {
      if (!live) return;
      setRes(r.error ? null : r);
      setMotifs(Array.isArray(m) ? m : []);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [surah.id, activeAyah]);

  if (loading) return <Loading />;

  return (
    <>
      <Panel title="رنين الكنتور" icon={<ArrowLeftRight className="h-3.5 w-3.5" />}>
        <p className="mb-2 text-[0.65rem] leading-relaxed text-muted-foreground">
          كنتور الآية {arabicNumber(activeAyah)}:{' '}
          <b className="font-mono tracking-[0.3em] text-gold">{res?.anchor.sig || '—'}</b>
          <br />
          ما يلي آياتٌ تحمل الكنتور نفسه، أو معكوسَه حين يتبادل المتكلمُ والغائبُ المقعد.
        </p>
        <div className="space-y-1.5">
          {res?.matches.map((m) => (
            <div
              key={`${m.surah}:${m.ayah}`}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span
                  className="text-[0.62rem]"
                  style={{ color: m.kind === 'inverted' ? '#F59E0B' : m.kind === 'identical' ? '#34D399' : '#94A3B8' }}
                >
                  {m.reason}
                </span>
                <span className="shrink-0 font-mono text-[0.58rem] tracking-widest text-muted-foreground">
                  {m.sig}
                </span>
              </div>
              <p className="quran mb-1.5 line-clamp-2 text-[1.1rem] leading-relaxed text-foreground/85">
                {m.text}
              </p>
              <div className="flex items-center justify-between">
                <span className="quran text-[0.85rem] text-muted-foreground">
                  {m.name} · {arabicNumber(m.ayah)}
                </span>
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => onCompare(m.surah, m.ayah)}>
                    قابِل
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => onOpenAyah(m.surah, m.ayah)}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!res?.matches.length && <Empty>لم يُعثر على كنتورٍ يرنّ مع هذه الآية.</Empty>}
        </div>
      </Panel>

      <Panel title="مثاني الإسناد المستخرجة" icon={<Sparkles className="h-3.5 w-3.5" />}>
        <p className="mb-2 text-[0.62rem] leading-relaxed text-muted-foreground">
          كنتوراتٌ متكرّرة استُخرجت بمُؤتَّمِ اللواحق (suffix automaton) على المصحف كلِّه، بلا سقفٍ لطولها.
        </p>
        <div className="space-y-1.5">
          {motifs.map((m) => (
            <div key={m.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[0.6rem] tracking-wider text-gold">{m.pattern}</span>
                <span className="text-[0.58rem] text-muted-foreground">
                  {arabicNumber(m.occurrences.length)} موضعًا · {arabicNumber(m.spread)} سورة
                </span>
              </div>
              <p className="mb-1.5 text-[0.62rem] text-muted-foreground">{m.gloss}</p>
              <div className="flex flex-wrap gap-1">
                {m.occurrences.slice(0, 10).map((o, i) => (
                  <button
                    key={i}
                    onClick={() => onOpenAyah(o.surah, o.ayah)}
                    className={cn(
                      'rounded px-1 py-px text-[0.58rem] tabular-nums transition-colors',
                      o.surah === surah.id
                        ? 'bg-gold/20 text-gold'
                        : 'bg-white/[0.05] text-muted-foreground hover:bg-white/10',
                    )}
                  >
                    {arabicNumber(o.surah)}:{arabicNumber(o.ayah)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!motifs.length && <Empty>لا كنتور متكرّر يمرّ بهذه السورة.</Empty>}
        </div>
      </Panel>
    </>
  );
}

// ── الطبقات ─────────────────────────────────────────────────────────────────
function TreePanel({ surah, frames, onOpenAyah }: MatrixProps) {
  const roots = frames.filter((f) => f.depth === 0);
  const byId = new Map(frames.map((f) => [f.id, f]));

  const render = (f: Frame, level: number): React.ReactNode => (
    <div key={f.id} style={{ marginRight: level * 14 }}>
      <button
        onClick={() => onOpenAyah(surah.id, f.ayahFrom)}
        className="mb-1 flex w-full items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-right transition-colors hover:bg-white/[0.06]"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: ['#C8A45C', '#34D399', '#60A5FA', '#C084FC', '#F472B6'][Math.min(f.depth, 4)] }}
        />
        <span className="quran flex-1 truncate text-[0.95rem]">{f.speaker.label}</span>
        {f.speaker.source === 'context' && (
          <span className="shrink-0 text-[0.55rem] text-muted-foreground/70" title="القائل مستنبَطٌ من السياق لا من فاعلٍ ظاهر">
            مستنبَط
          </span>
        )}
        <span className="shrink-0 text-[0.56rem] tabular-nums text-muted-foreground">
          {arabicNumber(f.ayahFrom)}
          {f.ayahTo !== f.ayahFrom && `–${arabicNumber(f.ayahTo)}`}
        </span>
      </button>
      {f.children.map((c) => {
        const child = byId.get(c);
        return child ? render(child, level + 1) : null;
      })}
    </div>
  );

  return (
    <Panel title="شجرة الإسناد المتداخل" icon={<GitBranch className="h-3.5 w-3.5" />}>
      <p className="mb-2 text-[0.62rem] leading-relaxed text-muted-foreground">
        يُفتَح إطارُ القول بفعلٍ من مادّة «قول». والفعلُ الغائب أو الأمر حكايةٌ من الراوي فيفتح إطارًا
        مستأنَفًا؛ أمّا المتكلم والمخاطب فلا يكونان إلا داخل قولٍ قائم، فيتداخل الإسناد.
      </p>
      <div className="space-y-0.5">
        {roots.length ? roots.map((f) => render(f, 0)) : <Empty>لا إطار قولٍ في هذه السورة.</Empty>}
      </div>
    </Panel>
  );
}

// ── الحجرة ──────────────────────────────────────────────────────────────────
function ChamberPanel({ surah, activeAyah, onOpenAyah }: MatrixProps) {
  const [walk, setWalk] = React.useState<TarteelStation[]>([]);
  const [seeds, setSeeds] = React.useState<{ surah: number; ayah: number; label: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [stations, setStations] = React.useState(7);

  const run = React.useCallback(
    async (s?: number, a?: number) => {
      setLoading(true);
      const qs = new URLSearchParams({ stations: String(stations) });
      if (s) qs.set('surah', String(s));
      if (a) qs.set('ayah', String(a));
      const r = await fetch(`/api/chamber?${qs}`).then((x) => x.json());
      setWalk(r.walk ?? []);
      setSeeds(r.seeds ?? []);
      setLoading(false);
    },
    [stations],
  );

  React.useEffect(() => {
    void run();
    // Deliberately once on mount: the walk is a composition the reader asks
    // for, not something that should churn as they browse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Panel
        title="حجرة اللاتزمّن"
        icon={<Hourglass className="h-3.5 w-3.5" />}
        action={
          <Button size="xs" variant="gold" onClick={() => run()} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            ارتحل
          </Button>
        }
      >
        <p className="mb-2 text-[0.64rem] leading-relaxed text-muted-foreground">
          ترتيلٌ من مقاماتٍ متتابعة، يُشترط في كل خطوةٍ أن تكون بعمليةٍ عربيةٍ غير التي قبلها: كنتورٌ
          مشترك، أو كنتورٌ منقلب، أو جذرٌ عائد، أو جسرٌ إلى الحاضر، أو لسانٌ من ألسنة الخلق، أو انقلابٌ
          في مسافة الخطاب. والمبتدأ من مواضعَ يُسائل فيها النصُّ مقدارَ ما مضى من الزمن —{' '}
          <b className="quran text-gold">إِلَيْهِ يُرَدُّ عِلْمُ ٱلسَّاعَةِ</b>.
        </p>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[0.62rem] text-muted-foreground">المقامات</span>
          <input
            type="range"
            min={3}
            max={13}
            value={stations}
            onChange={(e) => setStations(Number(e.target.value))}
            className="isnad-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to left, #C8A45C 0%, #C8A45C ${((stations - 3) / 10) * 100}%, rgba(255,255,255,0.09) ${((stations - 3) / 10) * 100}%, rgba(255,255,255,0.09) 100%)`,
            }}
          />
          <span className="w-5 text-[0.66rem] tabular-nums text-gold">{arabicNumber(stations)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="xs" variant="outline" onClick={() => run(surah.id, activeAyah)}>
            ابدأ من الآية الحاضرة
          </Button>
          {seeds.slice(0, 5).map((s) => (
            <button
              key={`${s.surah}:${s.ayah}`}
              onClick={() => run(s.surah, s.ayah)}
              className="quran rounded-full border border-white/10 px-2 py-0.5 text-[0.8rem] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Panel>

      <div className="space-y-0">
        {walk.map((st, i) => (
          <div key={`${st.surah}:${st.ayah}:${i}`} className="relative pr-5">
            {i < walk.length - 1 && (
              <span className="absolute right-[7px] top-6 h-full w-px bg-gradient-to-b from-gold/40 to-transparent" />
            )}
            <span className="absolute right-0 top-4 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gold/50 bg-background text-[0.5rem] tabular-nums text-gold">
              {arabicNumber(i + 1)}
            </span>
            <div className="mb-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge tone="gold">{st.operationLabel}</Badge>
                <button
                  onClick={() => onOpenAyah(st.surah, st.ayah)}
                  className="quran shrink-0 text-[0.85rem] text-muted-foreground transition-colors hover:text-gold"
                >
                  {st.surahName} · {arabicNumber(st.ayah)}
                </button>
              </div>
              <p className="quran mb-1.5 text-[1.15rem] leading-relaxed text-foreground/88">{st.text}</p>
              <MiniContour vec={st.vec} className="mb-1" />
              <p className="text-[0.62rem] leading-relaxed text-muted-foreground">{st.bridge}</p>
            </div>
          </div>
        ))}
        {!walk.length && !loading && <Empty>اضغط «ارتحل» لتأليف ترتيلٍ جديد.</Empty>}
      </div>
    </>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[0.72rem] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      يُستخرج…
    </div>
  );
}
