'use client';
// ============================================================================
//  Primitives in the shadcn idiom - cva variants, token colours, the same
//  class conventions - but hand-rolled rather than pulled from Radix. The
//  studio needs a button, a toggle, a slider, tabs and a tooltip; carrying a
//  headless-component tree for five controls would cost more than it returns,
//  and the range input in particular has to be styled from scratch either way.
// ============================================================================
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ── Button ──────────────────────────────────────────────────────────────────
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[0.78rem] font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        outline: 'border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20',
        ghost: 'hover:bg-white/[0.06] text-muted-foreground hover:text-foreground',
        gold: 'border border-gold/35 bg-gold/10 text-gold hover:bg-gold/20',
        subtle: 'bg-white/[0.05] text-foreground/80 hover:bg-white/10',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[0.72rem]',
        xs: 'h-6 px-2 text-[0.68rem]',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

// ── Toggle chip ─────────────────────────────────────────────────────────────
export function Toggle({
  active,
  onToggle,
  children,
  tone = 'gold',
  title,
  count,
}: {
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  tone?: 'gold' | 'mutakallim' | 'mukhatab' | 'ghaib' | 'khalq';
  title?: string;
  count?: number;
}) {
  const tones: Record<string, string> = {
    gold: 'border-gold/50 bg-gold/15 text-gold',
    mutakallim: 'border-mutakallim/50 bg-mutakallim/15 text-mutakallim-soft',
    mukhatab: 'border-mukhatab/50 bg-mukhatab/15 text-mukhatab-soft',
    ghaib: 'border-ghaib/50 bg-ghaib/15 text-ghaib-soft',
    khalq: 'border-khalq/50 bg-khalq/15 text-khalq-soft',
  };
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-medium transition-all',
        active
          ? tones[tone]
          : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground/80',
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn('tabular-nums opacity-60', active && 'opacity-80')}>{count}</span>
      )}
    </button>
  );
}

// ── Slider ──────────────────────────────────────────────────────────────────
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className,
  accent = 'gold',
  'aria-label': ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
  accent?: string;
  'aria-label'?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('isnad-range h-1.5 w-full cursor-pointer appearance-none rounded-full', className)}
      style={
        {
          // RTL: the filled portion has to grow from the right-hand edge.
          background: `linear-gradient(to left, ${accent} 0%, ${accent} ${fill}%, rgba(255,255,255,0.09) ${fill}%, rgba(255,255,255,0.09) 100%)`,
        } as React.CSSProperties
      }
    />
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-0.5 rounded-lg bg-black/25 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-[0.4rem] px-1.5 py-1.5 text-[0.7rem] font-medium transition-all',
            value === t.id
              ? 'bg-white/[0.09] text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground/75',
          )}
        >
          {t.icon}
          <span>{t.label}</span>
          {t.count !== undefined && t.count > 0 && (
            <span className="tabular-nums text-[0.62rem] opacity-55">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'gold' | 'mutakallim' | 'mukhatab' | 'ghaib' | 'khalq';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/[0.04] text-muted-foreground',
    gold: 'border-gold/30 bg-gold/10 text-gold',
    mutakallim: 'border-mutakallim/35 bg-mutakallim/10 text-mutakallim-soft',
    mukhatab: 'border-mukhatab/35 bg-mukhatab/10 text-mukhatab-soft',
    ghaib: 'border-ghaib/35 bg-ghaib/10 text-ghaib-soft',
    khalq: 'border-khalq/35 bg-khalq/10 text-khalq-soft',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.63rem] leading-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Section shell ───────────────────────────────────────────────────────────
export function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl glass p-3', className)}>
      <header className="mb-2.5 flex items-center justify-between">
        <h3 className="pane-title">
          {icon}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-[0.72rem] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
