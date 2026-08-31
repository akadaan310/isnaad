'use client';
// ============================================================================
//  الاستعاذة — the entry sequence.
//
//  Six phases. The one rule that shapes the whole component: the ألواح phase
//  presents the entire field AT ONCE. No stagger, no one-by-one reveal, no
//  waiting. The plates are already there when the phase opens, and the reader
//  chooses where to look — which is the difference between being shown a
//  landscape and being walked through a slideshow.
//
//  Evidence and reading are rendered in two visibly different registers, and
//  the reading always carries its attribution. See src/lib/istiadha.ts.
// ============================================================================
import * as React from 'react';
import { Loader2, ArrowLeft, Footprints, Sparkles, Waves } from 'lucide-react';
import { KHAL3, PHASES, PHASE_LABEL, type Phase } from '@/lib/istiadha';
import { PERSON_STYLE } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { Celestial, useSky } from '@/components/furqan/celestial';

interface Locus {
  surah: number;
  ayah: number;
  name: string;
  text: string;
}

interface PlateData {
  id: string;
  title: string;
  label: string;
  hue: string;
  count: number;
  related: number;
  spread: number;
  evidence: string;
  reading?: string;
  weight: number;
  loci: Locus[];
  featured: Locus[];
}

interface NujumData {
  title: string;
  name: string;
  text: string;
  evidence: string;
  reading: string;
  hibalNote: string;
  words: { text: string; person: 1 | 2 | 3 | null; num: string | null; khalq?: string }[];
  hibal: Locus[];
}

/** Each phase is shown under a figure, so the sequence moves across the sky. */
const PHASE_SKY: Record<Phase, string> = {
  tahyia: 'Ori',
  khal3: 'Boo',
  alwah: 'UMa',
  'fata-hut': 'Psc',
  nujum: 'Tau',
  dukhul: 'Cyg',
};

export function Istiadha({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = React.useState<Phase>('tahyia');
  const sky = useSky();
  const [plates, setPlates] = React.useState<PlateData[]>([]);
  const [nujum, setNujum] = React.useState<NujumData | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch('/api/istiadha')
      .then((r) => r.json())
      .then((d) => {
        setPlates((d.plates ?? []).sort((a: PlateData, b: PlateData) => a.weight - b.weight));
        setNujum(d.nujum ?? null);
      })
      .catch(() => undefined);
  }, []);

  const idx = PHASES.indexOf(phase);
  const next = () => setPhase(PHASES[Math.min(PHASES.length - 1, idx + 1)]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <Celestial
        data={sky}
        target={PHASE_SKY[phase]}
        intensity={phase === 'tahyia' ? 0.3 : 0.62}
        figures={phase !== 'tahyia'}
        labels={phase !== 'tahyia'}
        pulseKey={idx}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 48%, rgba(15,23,42,0.88), rgba(15,23,42,0.45) 65%, transparent 85%)',
        }}
      />

      {/* Warmth is highest at the opening and recedes as the field arrives. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-[2500ms]"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(200,164,92,0.16), transparent 70%)',
          opacity: phase === 'tahyia' ? 1 : 0.25,
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <ProgressRail phase={phase} onJump={(p) => setPhase(p)} />

        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll px-5 pb-6">
          {phase === 'tahyia' && <Tahyia onNext={next} />}
          {phase === 'khal3' && <Khal3 onNext={next} />}
          {phase === 'alwah' && (
            <Alwah plates={plates} open={open} setOpen={setOpen} onNext={next} />
          )}
          {phase === 'fata-hut' && <FataHut plates={plates} onNext={next} />}
          {phase === 'nujum' && <Nujum data={nujum} onNext={next} />}
          {phase === 'dukhul' && <Dukhul onDone={onDone} />}
        </div>
      </div>
    </div>
  );
}

function ProgressRail({ phase, onJump }: { phase: Phase; onJump: (p: Phase) => void }) {
  const idx = PHASES.indexOf(phase);
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 px-5 py-4">
      {PHASES.map((p, i) => (
        <button
          key={p}
          onClick={() => i <= idx && onJump(p)}
          disabled={i > idx}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.62rem] transition-all',
            i === idx
              ? 'bg-gold/15 text-gold'
              : i < idx
                ? 'text-muted-foreground hover:text-foreground/80'
                : 'text-muted-foreground/25',
          )}
        >
          <span
            className={cn(
              'h-1 w-1 rounded-full',
              i <= idx ? 'bg-gold' : 'bg-white/15',
            )}
          />
          {PHASE_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

// ── التهيئة ─────────────────────────────────────────────────────────────────
function Tahyia({ onNext }: { onNext: () => void }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    // Long enough that the room actually settles before anything is asked.
    const t = setTimeout(() => setReady(true), 3200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto flex min-h-[62vh] max-w-2xl flex-col items-center justify-center text-center">
      <p className="animate-breathe text-[0.72rem] tracking-[0.4em] text-gold/60">استعذ</p>
      <p className="quran mt-6 text-[2.1rem] leading-[2] text-foreground/90">
        أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيْطَٰنِ ٱلرَّجِيمِ
      </p>
      <p className="mt-6 max-w-md text-[0.8rem] leading-loose text-muted-foreground">
        قبل الدخول، تَمهَّلْ. هذه ليست شاشةَ تحميل — هي وقفةٌ مقصودة.
      </p>
      <button
        onClick={onNext}
        disabled={!ready}
        className={cn(
          'mt-10 rounded-full border px-6 py-2 text-[0.78rem] transition-all duration-1000',
          ready
            ? 'border-gold/50 bg-gold/10 text-gold hover:bg-gold/20'
            : 'border-white/5 text-muted-foreground/30',
        )}
      >
        {ready ? 'ابدأ' : '…'}
      </button>
    </div>
  );
}

// ── الخلع ───────────────────────────────────────────────────────────────────
function Khal3({ onNext }: { onNext: () => void }) {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <div className="mx-auto max-w-2xl py-6">
      <p className="quran text-center text-[1.5rem] leading-[2] text-gold">
        فَٱخْلَعْ نَعْلَيْكَ إِنَّكَ بِٱلْوَادِ ٱلْمُقَدَّسِ طُوًى
      </p>

      <div className="mt-8 rounded-2xl glass p-5">
        <p className="mb-3 text-center text-[0.95rem] text-foreground/90">{KHAL3.question}</p>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mx-auto block rounded-full border border-white/12 px-5 py-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
          >
            اكشِف
          </button>
        ) : (
          <div className="animate-fade-up space-y-3">
            <p className="text-[0.8rem] leading-loose text-foreground/75">{KHAL3.hadith}</p>
            <p className="text-[0.8rem] leading-loose text-foreground/75">{KHAL3.quran}</p>
            <div className="h-px rule-gold" />
            <p className="text-[0.86rem] leading-loose text-gold/90">{KHAL3.point}</p>
            <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-[0.68rem] leading-relaxed text-muted-foreground">
              {KHAL3.note}
            </p>
          </div>
        )}
      </div>

      {revealed && (
        <button
          onClick={onNext}
          className="mx-auto mt-8 flex animate-fade-up items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-6 py-2.5 text-[0.82rem] text-gold transition-all hover:bg-gold/20"
        >
          <Footprints className="h-4 w-4" />
          {KHAL3.action}
        </button>
      )}
    </div>
  );
}

// ── الألواح ─────────────────────────────────────────────────────────────────
//  The whole field, present at once.
function Alwah({
  plates, open, setOpen, onNext,
}: {
  plates: PlateData[];
  open: string | null;
  setOpen: (id: string | null) => void;
  onNext: () => void;
}) {
  if (!plates.length) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 text-center">
        <h2 className="quran text-[1.6rem] text-gold">الكهفُ — مقامُ الزمن</h2>
        <p className="mx-auto mt-1 max-w-2xl text-[0.72rem] leading-relaxed text-muted-foreground">
          الألواحُ كلُّها حاضرةٌ الآن، لا تأتي واحدًا بعد واحد. انظر حيث شئت.
          الأعدادُ محسوبةٌ من المصحف عند العرض، لا مكتوبةٌ في النصّ.
        </p>
      </header>

      {/* No stagger, no entrance delay: the field is already here. */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {plates.map((p) => (
          <PlateCard key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
        ))}
      </div>

      <button
        onClick={onNext}
        className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-6 py-2.5 text-[0.82rem] text-gold transition-all hover:bg-gold/20"
      >
        <ArrowLeft className="h-4 w-4" />
        تابِع
      </button>
    </div>
  );
}

function PlateCard({ p, open, onToggle }: { p: PlateData; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'rounded-xl border p-3 text-right transition-all',
        open
          ? 'bg-white/[0.055] sm:col-span-2 lg:col-span-3'
          : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.045]',
      )}
      style={open ? { borderColor: `${p.hue}66` } : undefined}
    >
      {/*
        No stat badge. The counts that matter already sit inside the evidence
        sentence, in words — «ثلاثةُ مواضع لا رابعَ لها» reads as a fact about
        the muṣḥaf, while «٣ · ٣ سورة» reads as a score. This is not a game.
      */}
      <h3 className="quran quran-tight text-[1.2rem]" style={{ color: p.hue }}>
        {p.title}
      </h3>

      <Evidence text={p.evidence} />

      {open && (
        <div className="mt-3 animate-fade-up space-y-3">
          {!!p.featured.length && (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {p.featured.map((l) => (
                <div key={`${l.surah}:${l.ayah}`} className="rounded-lg bg-black/25 p-2.5">
                  <p className="quran text-[1.15rem] leading-[2] text-foreground/85">{l.text}</p>
                  <p className="quran mt-1 text-[0.8rem] text-muted-foreground">
                    {l.name} · {arabicNumber(l.ayah)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {p.reading && <Reading text={p.reading} />}

          <div className="flex flex-wrap gap-1">
            {p.loci.map((l) => (
              <span
                key={`${l.surah}:${l.ayah}`}
                title={l.text}
                className="rounded bg-white/[0.05] px-1.5 py-px text-[0.6rem] tabular-nums text-muted-foreground"
              >
                {arabicNumber(l.surah)}:{arabicNumber(l.ayah)}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}

/** What the corpus shows. Plain, unmarked, load-bearing. */
function Evidence({ text }: { text: string }) {
  return (
    <p className="mt-1.5 text-[0.73rem] leading-relaxed text-foreground/70">{text}</p>
  );
}

/**
 * The composer's reading. Always visually distinct from evidence and always
 * carrying its attribution — a stranger must never mistake it for a finding.
 */
function Reading({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-r-2 border-gold/45 bg-gold/[0.05] p-2.5">
      <p className="mb-1 text-[0.58rem] tracking-wider text-gold/70">قراءةُ المؤلِّف</p>
      <p className="text-[0.76rem] leading-loose text-foreground/80">{text}</p>
    </div>
  );
}

// ── الفتى والحوت ────────────────────────────────────────────────────────────
function FataHut({ plates, onNext }: { plates: PlateData[]; onNext: () => void }) {
  const fata = plates.find((p) => p.id === 'fata');
  const hut = plates.find((p) => p.id === 'hut');
  return (
    <div className="mx-auto max-w-4xl py-4">
      <h2 className="quran mb-1 text-center text-[1.6rem] text-gold">فَتاكَ وحُوتُك</h2>
      <p className="mx-auto mb-6 max-w-xl text-center text-[0.74rem] leading-relaxed text-muted-foreground">
        الفتى يرافق، والحوتُ يفتح السبيل. وفي الكهف اجتمعا في موضعٍ واحد: نسِيَا حوتَهما، فاتّخذ
        سبيلَه في البحر سَرَبًا.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[fata, hut].map(
          (p) =>
            p && (
              <div key={p.id} className="rounded-xl glass p-4">
                <h3 className="quran mb-1 text-[1.3rem] leading-[1.9]" style={{ color: p.hue }}>
                  {p.title}
                </h3>
                <Evidence text={p.evidence} />
                {p.reading && <div className="mt-3"><Reading text={p.reading} /></div>}
              </div>
            ),
        )}
      </div>
      <button
        onClick={onNext}
        className="mx-auto mt-8 flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-6 py-2.5 text-[0.82rem] text-gold transition-all hover:bg-gold/20"
      >
        <Sparkles className="h-4 w-4" />
        إلى مواقع النجوم
      </button>
    </div>
  );
}

// ── مواقع النجوم ────────────────────────────────────────────────────────────
function Nujum({ data, onNext }: { data: NujumData | null; onNext: () => void }) {
  const [ropes, setRopes] = React.useState(false);
  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl py-4 text-center">
      <p className="quran text-[2rem] leading-[2.1]">
        {data.words.map((w, i) => (
          <span
            key={i}
            style={{
              color: w.person ? PERSON_STYLE[w.person].soft : undefined,
              textDecoration: w.khalq ? 'underline' : undefined,
              textDecorationColor: '#C084FC',
              textDecorationThickness: '2px',
              textUnderlineOffset: '0.34em',
            }}
          >
            {w.text}{' '}
          </span>
        ))}
      </p>
      <p className="quran mt-2 text-[0.85rem] text-muted-foreground">
        {data.name} · {arabicNumber(55)}:{arabicNumber(6)}
      </p>

      <div className="mt-6 rounded-xl glass p-4 text-right">
        <Evidence text={data.evidence} />
        <div className="mt-3">
          <Reading text={data.reading} />
        </div>
      </div>

      <button
        onClick={() => setRopes((v) => !v)}
        className="mx-auto mt-5 flex items-center gap-2 rounded-full border border-khalq/40 bg-khalq/10 px-5 py-2 text-[0.78rem] text-khalq-soft transition-all hover:bg-khalq/20"
      >
        <Waves className="h-4 w-4" />
        {ropes ? 'أخفِ الحِبال' : 'أظهِر الحِبال'}
      </button>

      {ropes && (
        <div className="mt-4 animate-fade-up rounded-xl border border-khalq/25 bg-khalq/[0.04] p-4 text-right">
          <p className="mb-3 text-[0.73rem] leading-relaxed text-foreground/70">{data.hibalNote}</p>
          <div className="space-y-1.5">
            {data.hibal.map((l) => (
              <div key={`${l.surah}:${l.ayah}`} className="rounded-lg bg-black/25 p-2">
                <p className="quran text-[1.1rem] leading-[2] text-foreground/80">{l.text}</p>
                <p className="quran mt-0.5 text-[0.75rem] text-muted-foreground">
                  {l.name} · {arabicNumber(l.ayah)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="mx-auto mt-8 flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-6 py-2.5 text-[0.82rem] text-gold transition-all hover:bg-gold/20"
      >
        <ArrowLeft className="h-4 w-4" />
        تابِع
      </button>
    </div>
  );
}

// ── الدخول ──────────────────────────────────────────────────────────────────
function Dukhul({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto flex min-h-[58vh] max-w-xl flex-col items-center justify-center text-center">
      <p className="quran text-[1.7rem] leading-[2] text-gold">
        وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
      </p>
      <p className="mt-6 max-w-sm text-[0.8rem] leading-loose text-muted-foreground">
        خُلِعَت. اختَر سورةً الآن — وستراها وقد صار لها ما تقوله.
      </p>
      <button
        onClick={onDone}
        className="mt-9 rounded-full border border-gold/60 bg-gold/15 px-8 py-3 text-[0.88rem] text-gold transition-all hover:bg-gold/25"
      >
        ادخُل
      </button>
    </div>
  );
}
