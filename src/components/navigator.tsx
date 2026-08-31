'use client';
// ============================================================================
//  Pane 1 — الفهرس: the 114, the ajzāʾ, and the filters that govern the studio.
// ============================================================================
import * as React from 'react';
import { Search, Sparkles, Layers, MessageSquare, Radar, X } from 'lucide-react';
import type { SurahMeta } from '@/lib/types';
import { PERSON_STYLE, PROXIMITY_MODES } from '@/lib/view';
import { arabicNumber, cn, pct } from '@/lib/utils';
import { Slider, Toggle } from './ui';
import { MiniContour } from './waveform';

export interface Filters {
  showSeams: boolean;
  showKhalq: boolean;
  onlyMunajah: boolean;
  distance: [number, number];
}

export function Navigator({
  metas,
  current,
  onSelect,
  filters,
  setFilters,
  juz,
  setJuz,
}: {
  metas: SurahMeta[];
  current: number;
  onSelect: (id: number) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  juz: number | null;
  setJuz: (j: number | null) => void;
}) {
  const [q, setQ] = React.useState('');

  const list = React.useMemo(() => {
    const needle = q.trim();
    return metas.filter((m) => {
      if (juz && !(m.juzRange[0] <= juz && m.juzRange[1] >= juz)) return false;
      if (!needle) return true;
      return (
        m.name.includes(needle) ||
        m.transliteration.toLowerCase().includes(needle.toLowerCase()) ||
        String(m.id) === needle ||
        arabicNumber(m.id) === needle
      );
    });
  }, [metas, q, juz]);

  const [lo, hi] = filters.distance;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── search ── */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في السور…"
          className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pr-8 pl-2 text-[0.78rem] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold/40"
        />
      </div>

      {/* ── overlays ── */}
      <div>
        <p className="mb-1.5 text-[0.68rem] font-medium text-muted-foreground">طبقات الكشف</p>
        <div className="flex flex-wrap gap-1.5">
          <Toggle
            active={filters.showSeams}
            onToggle={() => setFilters({ ...filters, showSeams: !filters.showSeams })}
            tone="gold"
            title="إظهار علامة عند كل موضع يتحوّل فيه الإسناد"
          >
            <Radar className="h-3 w-3" />
            الالتفات
          </Toggle>
          <Toggle
            active={filters.showKhalq}
            onToggle={() => setFilters({ ...filters, showKhalq: !filters.showKhalq })}
            tone="khalq"
            title="إبراز غير الإنسيّ حين يقع في مقعد الإسناد إليه"
          >
            <Layers className="h-3 w-3" />
            ألسنة الخلق
          </Toggle>
          <Toggle
            active={filters.onlyMunajah}
            onToggle={() => setFilters({ ...filters, onlyMunajah: !filters.onlyMunajah })}
            tone="mukhatab"
            title="قصر العرض على الآيات الغالب عليها الخطاب المباشر"
          >
            <MessageSquare className="h-3 w-3" />
            المناجاة
          </Toggle>
        </div>
      </div>

      {/* ── the proximity axis ── */}
      <div className="rounded-lg glass p-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[0.72rem] font-semibold text-gold/85">البُعد والقُرب</p>
          <span className="text-[0.62rem] tabular-nums text-muted-foreground">
            {pct(lo)} — {pct(hi)}
          </span>
        </div>

        <div className="mb-2 flex gap-1">
          {PROXIMITY_MODES.map((m) => {
            const on = lo <= m.range[0] + 0.01 && hi >= m.range[1] - 0.01;
            return (
              <button
                key={m.id}
                title={m.gloss}
                onClick={() => setFilters({ ...filters, distance: m.range })}
                className={cn(
                  'flex-1 rounded-md border px-1 py-1.5 text-center transition-all',
                  on ? 'border-transparent' : 'border-white/[0.08] bg-white/[0.02]',
                )}
                style={on ? { background: `${m.hex}22`, borderColor: `${m.hex}66` } : undefined}
              >
                <span
                  className="block text-[0.68rem] font-semibold"
                  style={{ color: on ? m.hex : undefined }}
                >
                  {m.label}
                </span>
                <span className="block text-[0.58rem] text-muted-foreground">{m.sub}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Slider
            aria-label="أدنى مسافة الخطاب"
            value={lo}
            min={0}
            max={1}
            step={0.01}
            accent={PERSON_STYLE[2].hex}
            onChange={(v) => setFilters({ ...filters, distance: [Math.min(v, hi), hi] })}
          />
          <Slider
            aria-label="أقصى مسافة الخطاب"
            value={hi}
            min={0}
            max={1}
            step={0.01}
            accent={PERSON_STYLE[3].hex}
            onChange={(v) => setFilters({ ...filters, distance: [lo, Math.max(v, lo)] })}
          />
        </div>
        <p className="mt-1.5 text-[0.6rem] leading-relaxed text-muted-foreground">
          من المناجاة (المخاطب) إلى الغيبة (الغائب)، والمعاينة بينهما.
        </p>
      </div>

      {/* ── juz filter ── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[0.68rem] font-medium text-muted-foreground">الأجزاء</p>
          {juz && (
            <button
              onClick={() => setJuz(null)}
              className="flex items-center gap-0.5 text-[0.62rem] text-gold hover:underline"
            >
              <X className="h-2.5 w-2.5" />
              إلغاء
            </button>
          )}
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
            <button
              key={j}
              onClick={() => setJuz(juz === j ? null : j)}
              className={cn(
                'rounded py-1 text-[0.6rem] tabular-nums transition-colors',
                juz === j
                  ? 'bg-gold/25 text-gold'
                  : 'bg-white/[0.03] text-muted-foreground hover:bg-white/[0.08]',
              )}
            >
              {arabicNumber(j)}
            </button>
          ))}
        </div>
      </div>

      {/* ── the 114 ── */}
      <div className="min-h-0 flex-1 overflow-y-auto thin-scroll -mx-1 px-1">
        <div className="space-y-0.5">
          {list.map((m) => (
            <SurahRow key={m.id} m={m} active={m.id === current} onClick={() => onSelect(m.id)} />
          ))}
          {!list.length && (
            <p className="px-2 py-6 text-center text-[0.72rem] text-muted-foreground">
              لا سورة بهذا الوصف
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SurahRow({ m, active, onClick }: { m: SurahMeta; active: boolean; onClick: () => void }) {
  const total = Object.values(m.discoveryCounts).reduce((a, b) => a + b, 0);
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg px-2 py-1.5 text-right transition-all',
        active ? 'bg-gold/12 ring-1 ring-gold/25' : 'hover:bg-white/[0.05]',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[0.58rem] tabular-nums',
            active ? 'bg-gold/25 text-gold' : 'bg-white/[0.06] text-muted-foreground',
          )}
        >
          {arabicNumber(m.id)}
        </span>
        <span className="quran quran-tight flex-1 truncate text-[1.05rem]">{m.name}</span>
        {total > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-[0.58rem] tabular-nums text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" />
            {arabicNumber(total)}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1.5 pr-7">
        <MiniContour vec={m.vec} className="flex-1" />
        <span className="shrink-0 text-[0.55rem] tabular-nums text-muted-foreground">
          {m.type === 'makkiyyah' ? 'مكية' : 'مدنية'} · {arabicNumber(m.ayahCount)}
        </span>
      </div>
    </button>
  );
}
