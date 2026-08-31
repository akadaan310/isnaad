'use client';
// ============================================================================
//  التأليف — the composer.
//
//  Build a برج by naming a عَلَم and letting the assembler pack it, then edit:
//  reorder, cut, rewrite the framing. The assembler's output is a draft, and
//  the point of this pane is that the draft is a starting point you argue with.
// ============================================================================
import * as React from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Save, Play, Eye, EyeOff, Loader2, ChevronUp, ChevronDown,
  Sparkles, GripVertical,
} from 'lucide-react';
import type { Composition, Movement, Station } from '@/lib/composition';
import { stationCount } from '@/lib/composition';
import { FAMILY_LABEL, type AlamFamily } from '@/lib/aalam';
import { arabicNumber, cn } from '@/lib/utils';
import { Button, Empty, Panel } from './ui';

interface AlamRow {
  id: string;
  label: string;
  gloss: string;
  family: AlamFamily;
  hue: string;
  count: number;
  spread: number;
  associated: number;
}

export function Composer({ initial }: { initial: Composition[] }) {
  const [list, setList] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(initial[0]?.id ?? null);
  const [doc, setDoc] = React.useState<Composition | null>(initial[0] ?? null);
  const [aalam, setAalam] = React.useState<AlamRow[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  /** locus -> Uthmani text, so a station row can show what it actually is. */
  const [texts, setTexts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    void fetch('/api/aalam').then((r) => r.json()).then(setAalam);
  }, []);

  React.useEffect(() => {
    if (!activeId) return;
    void fetch(`/api/compositions/${activeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Composition | null) => {
        if (!c) return;
        setDoc(c);
        setDirty(false);
      });
  }, [activeId]);

  // Reordering must not refetch, so this keys on the set of loci, not the doc.
  const lociKey = React.useMemo(
    () =>
      doc
        ? [...new Set(doc.movements.flatMap((m) => m.stations.map((st) => `${st.surah}:${st.ayah}`)))]
            .sort()
            .join(',')
        : '',
    [doc],
  );

  React.useEffect(() => {
    if (!lociKey) return;
    const loci = lociKey.split(',').map((k) => k.split(':').map(Number) as [number, number]);
    const missing = loci.filter(([sx, ax]) => !texts[`${sx}:${ax}`]);
    if (!missing.length) return;
    void fetch('/api/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loci: missing }),
    })
      .then((r) => r.json())
      .then((d: Record<string, { uthmani: string }>) => {
        setTexts((cur) => {
          const next = { ...cur };
          for (const [k, v] of Object.entries(d)) next[k] = v.uthmani;
          return next;
        });
      })
      .catch(() => undefined);
    // `texts` is intentionally out of the dependency list: it is what this
    // effect writes, and including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lociKey]);

  const patch = (p: Partial<Composition>) => {
    setDoc((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
  };

  const create = async () => {
    setBusy('create');
    const c: Composition = await fetch('/api/compositions', { method: 'POST' }).then((r) => r.json());
    setList((l) => [c, ...l]);
    setActiveId(c.id);
    setDoc(c);
    setDirty(false);
    setBusy(null);
  };

  const save = async () => {
    if (!doc) return;
    setBusy('save');
    const saved: Composition = await fetch(`/api/compositions/${doc.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(doc),
    }).then((r) => r.json());
    setDoc(saved);
    setList((l) => l.map((c) => (c.id === saved.id ? saved : c)));
    setDirty(false);
    setBusy(null);
  };

  const remove = async (id: string) => {
    await fetch(`/api/compositions/${id}`, { method: 'DELETE' });
    setList((l) => l.filter((c) => c.id !== id));
    if (activeId === id) {
      const next = list.find((c) => c.id !== id) ?? null;
      setActiveId(next?.id ?? null);
      setDoc(next);
    }
  };

  const addMovement = async (alamId: string) => {
    if (!doc) return;
    setBusy(alamId);
    const res = await fetch(`/api/assemble?alam=${alamId}&limit=10`);
    if (res.ok) {
      const m: Movement = await res.json();
      // Ids must be unique inside one composition; the same عَلَم may be used twice.
      const id = doc.movements.some((x) => x.id === m.id) ? `${m.id}-${doc.movements.length}` : m.id;
      patch({ movements: [...doc.movements, { ...m, id }] });
    }
    setBusy(null);
  };

  const mutateMovement = (mi: number, fn: (m: Movement) => Movement) => {
    if (!doc) return;
    patch({ movements: doc.movements.map((m, i) => (i === mi ? fn(m) : m)) });
  };

  const moveMovement = (mi: number, dir: number) => {
    if (!doc) return;
    const next = [...doc.movements];
    const to = mi + dir;
    if (to < 0 || to >= next.length) return;
    [next[mi], next[to]] = [next[to], next[mi]];
    patch({ movements: next });
  };

  const byFamily = React.useMemo(() => {
    const groups = new Map<AlamFamily, AlamRow[]>();
    for (const a of aalam) {
      const arr = groups.get(a.family) ?? [];
      arr.push(a);
      groups.set(a.family, arr);
    }
    return [...groups.entries()];
  }, [aalam]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <span className="quran text-[1.35rem] leading-none text-gold">التأليف</span>
        <nav className="flex items-center gap-1.5 text-[0.7rem]">
          <Link href="/" className="text-muted-foreground hover:text-gold">المرصد</Link>
          <span className="text-white/15">·</span>
          <Link href="/gallery" className="text-muted-foreground hover:text-gold">المعرض</Link>
        </nav>
        <div className="mr-auto flex items-center gap-1.5">
          {doc && (
            <>
              {dirty && <span className="text-[0.62rem] text-gold/80">تغييراتٌ لم تُحفظ</span>}
              <Button size="sm" variant="outline" onClick={() => patch({ published: !doc.published })}>
                {doc.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {doc.published ? 'منشور' : 'مسودّة'}
              </Button>
              <Link href={`/watch/${doc.id}`} target="_blank">
                <Button size="sm" variant="outline">
                  <Play className="h-3 w-3" />
                  اعرِض
                </Button>
              </Link>
              <Button size="sm" variant="gold" onClick={save} disabled={busy === 'save' || !dirty}>
                {busy === 'save' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                احفظ
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* ── compositions ── */}
        <aside className="hidden w-60 shrink-0 flex-col gap-2 rounded-2xl glass p-3 lg:flex">
          <Button size="sm" variant="gold" onClick={create} disabled={busy === 'create'}>
            <Plus className="h-3 w-3" />
            تأليفٌ جديد
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto thin-scroll">
            {list.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors',
                  c.id === activeId ? 'bg-gold/12 ring-1 ring-gold/25' : 'hover:bg-white/[0.05]',
                )}
              >
                <button onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 text-right">
                  <span className="quran block truncate text-[1rem]">{c.title}</span>
                  <span className="block text-[0.58rem] text-muted-foreground">
                    {arabicNumber(c.movements.length)} بروج
                    {c.published && ' · منشور'}
                  </span>
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {!list.length && <Empty>لا تأليف بعد.</Empty>}
          </div>
        </aside>

        {/* ── the working composition ── */}
        <main className="min-w-0 flex-1 space-y-3 overflow-y-auto thin-scroll rounded-2xl glass p-4">
          {!doc ? (
            <Empty>أنشئ تأليفًا لتبدأ.</Empty>
          ) : (
            <>
              <div className="space-y-2">
                <input
                  value={doc.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  className="quran w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[1.5rem] outline-none focus:border-gold/40"
                  placeholder="عنوان التأليف"
                />
                <input
                  value={doc.subtitle ?? ''}
                  onChange={(e) => patch({ subtitle: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[0.78rem] outline-none focus:border-gold/40"
                  placeholder="سطرٌ تحت العنوان"
                />
                <textarea
                  value={doc.intent ?? ''}
                  onChange={(e) => patch({ intent: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.78rem] leading-relaxed outline-none focus:border-gold/40"
                  placeholder="ما الذي يُراد من هذا التأليف أن يُرى؟"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                    مُكْث كل مقام
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={doc.dwell}
                      onChange={(e) => patch({ dwell: Math.max(3, Math.min(60, Number(e.target.value) || 9)) })}
                      className="w-16 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-center outline-none focus:border-gold/40"
                    />
                    ثانية
                  </label>
                  <span className="text-[0.66rem] text-muted-foreground">
                    {arabicNumber(doc.movements.length)} بروج · {arabicNumber(stationCount(doc))} مقامًا
                  </span>
                </div>
              </div>

              <div className="h-px rule-gold" />

              {doc.movements.map((m, mi) => (
                <MovementCard
                  key={m.id}
                  m={m}
                  mi={mi}
                  last={mi === doc.movements.length - 1}
                  onMove={(d) => moveMovement(mi, d)}
                  onDelete={() => patch({ movements: doc.movements.filter((_, i) => i !== mi) })}
                  onChange={(fn) => mutateMovement(mi, fn)}
                  texts={texts}
                />
              ))}

              {!doc.movements.length && (
                <Empty>اختر عَلَمًا من اليسار ليُبنى حوله برجٌ أوّل.</Empty>
              )}
            </>
          )}
        </main>

        {/* ── the أعلام ── */}
        <aside className="hidden w-[21rem] shrink-0 flex-col gap-3 overflow-y-auto thin-scroll rounded-2xl glass p-3 xl:flex">
          <div>
            <h3 className="pane-title mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              الأعلام
            </h3>
            <p className="text-[0.62rem] leading-relaxed text-muted-foreground">
              اختر عَلَمًا فيُبنى حوله برجٌ كامل: كلُّ موضعٍ من مواضعه، يتلوه ما وجده محرّك الإسناد
              في ذلك الموضع نفسه.
            </p>
          </div>
          {byFamily.map(([family, rows]) => (
            <Panel key={family} title={FAMILY_LABEL[family]}>
              <div className="space-y-1">
                {rows.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => addMovement(a.id)}
                    disabled={!doc || busy === a.id}
                    title={a.gloss}
                    className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 text-right transition-all hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="quran flex items-center gap-1.5 text-[1.05rem]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.hue }} />
                        {a.label}
                      </span>
                      <span className="shrink-0 text-[0.6rem] tabular-nums text-muted-foreground">
                        {busy === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          `${arabicNumber(a.count)} موضعًا`
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[0.62rem] leading-relaxed text-muted-foreground">
                      {a.gloss}
                    </p>
                  </button>
                ))}
              </div>
            </Panel>
          ))}
        </aside>
      </div>
    </div>
  );
}

function MovementCard({
  m, mi, last, onMove, onDelete, onChange, texts,
}: {
  m: Movement;
  mi: number;
  last: boolean;
  onMove: (dir: number) => void;
  onDelete: () => void;
  onChange: (fn: (m: Movement) => Movement) => void;
  texts: Record<string, string>;
}) {
  const [open, setOpen] = React.useState(true);

  const setStation = (si: number, p: Partial<Station>) =>
    onChange((mv) => ({ ...mv, stations: mv.stations.map((s, i) => (i === si ? { ...s, ...p } : s)) }));

  const dropStation = (si: number) =>
    onChange((mv) => ({ ...mv, stations: mv.stations.filter((_, i) => i !== si) }));

  const moveStation = (si: number, dir: number) =>
    onChange((mv) => {
      const next = [...mv.stations];
      const to = si + dir;
      if (to < 0 || to >= next.length) return mv;
      [next[si], next[to]] = [next[to], next[si]];
      return { ...mv, stations: next };
    });

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <header className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <span className="shrink-0 rounded-full bg-gold/15 px-1.5 text-[0.6rem] tabular-nums text-gold">
          {arabicNumber(mi + 1)}
        </span>
        <input
          value={m.title}
          onChange={(e) => onChange((mv) => ({ ...mv, title: e.target.value }))}
          className="quran min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[1.2rem] outline-none hover:border-white/10 focus:border-gold/40"
        />
        <span className="shrink-0 text-[0.6rem] text-muted-foreground">
          {arabicNumber(m.stations.length)} مقامًا
        </span>
        <button onClick={() => onMove(-1)} disabled={mi === 0} className="shrink-0 text-muted-foreground disabled:opacity-25 hover:text-foreground">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onMove(1)} disabled={last} className="shrink-0 text-muted-foreground disabled:opacity-25 hover:text-foreground">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 text-[0.62rem] text-gold">
          {open ? 'اطوِ' : 'افتح'}
        </button>
      </header>

      <textarea
        value={m.note ?? ''}
        onChange={(e) => onChange((mv) => ({ ...mv, note: e.target.value }))}
        rows={2}
        placeholder="الدرس: ما الذي يُظهره هذا البرج؟"
        className="mt-2 w-full resize-none rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 text-[0.7rem] leading-relaxed outline-none focus:border-gold/40"
      />

      {open && (
        <ol className="mt-2 space-y-1">
          {m.stations.map((s, si) => (
            <li
              key={`${s.surah}:${s.ayah}:${si}`}
              className="group flex items-start gap-2 rounded-lg border border-white/[0.05] bg-black/15 p-2"
            >
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    s.source === 'discovery' ? '#C8A45C' : s.source === 'associated' ? '#94A3B8' : '#34D399',
                }}
                title={s.source}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[0.62rem] tabular-nums text-gold">
                    {arabicNumber(s.surah)}:{arabicNumber(s.ayah)}
                  </span>
                  <p className="quran min-w-0 flex-1 truncate text-[1.05rem] text-foreground/80">
                    {texts[`${s.surah}:${s.ayah}`] ?? '…'}
                  </p>
                </div>
                <input
                  value={s.caption ?? ''}
                  onChange={(e) => setStation(si, { caption: e.target.value })}
                  placeholder="سطر التأطير"
                  className="mt-1 w-full rounded border border-transparent bg-transparent px-1 text-[0.68rem] text-muted-foreground outline-none hover:border-white/10 focus:border-gold/40 focus:text-foreground"
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => moveStation(si, -1)} className="text-muted-foreground hover:text-foreground">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button onClick={() => moveStation(si, 1)} className="text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button onClick={() => dropStation(si)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
          {!m.stations.length && <Empty>لا مقامات في هذا البرج.</Empty>}
        </ol>
      )}
    </section>
  );
}
