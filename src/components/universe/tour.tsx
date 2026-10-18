'use client';
// ============================================================================
//  الجولة — sixty seconds, six stations, then the studio is yours.
//
//  Each station says one thing and the camera shows it. It can be skipped at
//  any point, it never repeats on its own after it has been finished or
//  skipped once, and it can always be reopened from the dock.
// ============================================================================
import * as React from 'react';
import { arabicNumber } from '@/lib/numerals';

export interface TourStep {
  title: string;
  body: string;
  /** What the studio should do when this station opens. */
  act: 'home' | 'colours' | 'inspect' | 'voyage' | 'fly' | 'honesty';
}

export const TOUR: TourStep[] = [
  {
    title: 'الكونُ كاملًا',
    body: 'كلُّ نقطةٍ آيةٌ — ٦٬٢٣٦ آية من ١١٤ سورة، لا يُستثنى منها شيء. الاتجاه هو ترتيب المصحف: الفاتحة في القطب الأعلى والناس في الأسفل. ونصف القطر مسافة الخطاب: الأقرب إليك المخاطَب، والأبعد الغائب.',
    act: 'home',
  },
  {
    title: 'الألوان',
    body: 'البرتقالي المتكلم، والأخضر المخاطب، والأزرق الغائب — بحسب الضمير الغالب في إسناد الآية. والرمادي على الحلقة المنقّطة الخارجية: آياتٌ ليس فيها إسنادٌ إلى شخص، وُضعت وحدها ولم تُلحق بغيرها.',
    act: 'colours',
  },
  {
    title: 'افحص آية',
    body: 'المسْ آيةً أو انقرها. يظهر نصّها العثماني، وما وجده المحرّك فيها، وروابطها: جذرٌ نادر مشترك، أو كنتور مثاني، أو استنباط يعبر حدَّ الآية. هذه هود ٢٩.',
    act: 'inspect',
  },
  {
    title: 'الرحلة الآلية',
    body: 'اكتب بذرةً — أيَّ كلمة — فيُبنى منها مسارٌ ثابت عبر الروابط المحسوبة. البذرة نفسها تعطي المسار نفسه دائمًا، فتستطيع أن تحفظه وترسله وتعيده.',
    act: 'voyage',
  },
  {
    title: 'الطيران بيدك',
    body: 'اسحب لتنظر، وW A S D أو الأسهم للحركة، وQ/E للأسفل والأعلى، وShift للسرعة. على الهاتف: إصبع للنظر وإصبعان للتقدّم. زرّ «العودة» يرجعك دائمًا.',
    act: 'fly',
  },
  {
    title: 'ما هذا وما ليس هو',
    body: 'كلّ ما تراه استنباطٌ آليّ من الوسم الصرفي، يدلّك أين تنظر ولا يفسّر. والنجوم في عدسةٍ مستقلّة بإحداثياتها الفلكية؛ لا صلة فيزيائية بينها وبين مواضع الآيات.',
    act: 'honesty',
  },
];

export const STEP_SECONDS = 10;

export function Tour({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (i: number) => void;
  onClose: (finished: boolean) => void;
}) {
  const [left, setLeft] = React.useState(STEP_SECONDS);
  React.useEffect(() => setLeft(STEP_SECONDS), [step]);
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((x) => {
        if (x > 1) return x - 1;
        if (step + 1 < TOUR.length) onStep(step + 1);
        else onClose(true);
        return STEP_SECONDS;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, onStep, onClose]);

  const s = TOUR[step];
  return (
    <div
      role="dialog"
      aria-label="جولة تعريفية"
      data-testid="tour"
      className="pointer-events-auto absolute inset-x-3 bottom-[124px] z-30 mx-auto max-w-md rounded-xl border border-gold/40 bg-[#0b1120]/90 p-4 shadow-2xl backdrop-blur animate-fade-up"
    >
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {arabicNumber(step + 1)} / {arabicNumber(TOUR.length)}
        </span>
        <span aria-live="polite">{arabicNumber(left)}ث</span>
      </div>
      <h2 className="mb-2 text-lg text-gold">{s.title}</h2>
      <p className="text-sm leading-7 text-foreground/90">{s.body}</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-md bg-gold/90 px-3 py-1.5 text-sm text-black" onClick={() => (step + 1 < TOUR.length ? onStep(step + 1) : onClose(true))}>
          {step + 1 < TOUR.length ? 'التالي' : 'ابدأ'}
        </button>
        {step > 0 && (
          <button className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={() => onStep(step - 1)}>
            السابق
          </button>
        )}
        <button className="ms-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground" onClick={() => onClose(false)}>
          تخطَّ
        </button>
      </div>
    </div>
  );
}
