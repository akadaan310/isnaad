'use client';
// ============================================================================
//  الأساس — choosing what direction is made of.
//
//  The برج placement stays the default and nothing moves until the reader
//  moves it. What the control offers is the comparison: `npm run basis`
//  measures that under the placement in use, two related āyāt are 14% *further*
//  apart than two picked at random, and this is where that becomes something
//  you can watch rather than read.
//
//  The constellation is not being taken away. It remains the celestial
//  reference — the far sky, the figures, the name of the region an āyah is in.
//  What it stops being is the hidden cause of a position offered as meaningful.
// ============================================================================
import * as React from 'react';
import { Compass, Loader2 } from 'lucide-react';
import type { BasisId } from '@/lib/cosmos/basis';
import { arabicDecimal, cn } from '@/lib/utils';

export const BASIS_CHOICES: { id: BasisId; label: string; note: string }[] = [
  { id: 'constellation', label: 'البُروج', note: 'الاتجاه من مركز البرج — تسميةٌ لا حساب' },
  { id: 'isnad', label: 'مَزيج الإسناد', note: 'الطول من مزيج المتكلم والمخاطب والغائب، والعرض من محور الزمن' },
  { id: 'contour', label: 'الكنتور', note: 'الطول من كنتور الإسناد كسرًا ثلاثيًا، والعرض من محور الزمن' },
  { id: 'spectral', label: 'طيفُ الخيوط', note: 'الاتجاه من موضع الآية في شبكة الخيوط نفسها' },
];

export function BasisControl({
  basis,
  setBasis,
  blend,
  setBlend,
  locality,
  loading,
}: {
  basis: BasisId;
  setBasis: (b: BasisId) => void;
  blend: number;
  setBlend: (n: number) => void;
  /** median related distance ÷ median random distance, under this basis. */
  locality: number | null;
  loading: boolean;
}) {
  const active = BASIS_CHOICES.find((b) => b.id === basis)!;
  return (
    <div className="w-48 rounded-xl border border-white/[0.07] bg-black/40 p-2 backdrop-blur-sm">
      <p className="mb-1.5 flex items-center gap-1 text-[0.58rem] tracking-wider text-gold/70">
        <Compass className="h-3 w-3" />
        أساسُ الاتجاه
        {loading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      </p>
      <div className="space-y-0.5">
        {BASIS_CHOICES.map((b) => (
          <button
            key={b.id}
            onClick={() => setBasis(b.id)}
            title={b.note}
            className={cn(
              'quran w-full rounded px-1.5 py-1 text-right text-[0.85rem] transition-colors',
              basis === b.id ? 'bg-white/[0.07] text-gold' : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-[0.5rem] leading-snug text-muted-foreground/70">
        {active.note}
      </p>

      {basis !== 'constellation' && (
        <label className="mt-1.5 block text-[0.52rem] text-muted-foreground/70">
          <span className="mb-0.5 block">
            المَيل إلى الأساس · {arabicDecimal(blend, 2)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={blend}
            onChange={(e) => setBlend(Number(e.target.value))}
            className="isnad-range h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10"
          />
        </label>
      )}

      {locality !== null && (
        <p
          className="mt-1.5 text-[0.5rem] leading-snug"
          title="متوسط بُعد الآيتين المرتبطتين، مقسومًا على بُعد آيتين اتّفاقًا. الواحدُ يعني أنّ الأساس لا يرى البنية."
          style={{ color: locality < 0.85 ? '#6EE7B7' : locality > 1 ? '#FCA5A5' : '#CBD5E1' }}
        >
          قُربُ المرتبطات · {arabicDecimal(locality, 3)}
          {locality > 1 ? ' — المرتبطُ أبعدُ من المتّفِق' : ''}
        </p>
      )}
    </div>
  );
}
