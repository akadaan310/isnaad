import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        // ── الإسناد axis ────────────────────────────────────
        mutakallim: { DEFAULT: '#D97706', soft: '#FCD34D', deep: '#78350F' }, // المتكلم
        mukhatab: { DEFAULT: '#059669', soft: '#6EE7B7', deep: '#064E3B' },   // المخاطب
        ghaib: { DEFAULT: '#0284C7', soft: '#7DD3FC', deep: '#0C4A6E' },      // الغائب
        khalq: { DEFAULT: '#C084FC', soft: '#E9D5FF', deep: '#4C1D95' },      // ألسنة الخلق
        gold: { DEFAULT: '#C8A45C', soft: '#E8D7A8', deep: '#7A6224' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        quran: ['var(--font-quran)', 'Amiri Quran', 'Scheherazade New', 'Traditional Arabic', 'serif'],
        arabic: ['var(--font-arabic)', 'Noto Kufi Arabic', 'Tajawal', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '1' } },
        'pulse-seam': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(200,164,92,0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(200,164,92,0.14)' },
        },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'breathe': { '0%,100%': { transform: 'scale(1)', opacity: '0.7' }, '50%': { transform: 'scale(1.04)', opacity: '1' } },
      },
      animation: {
        shimmer: 'shimmer 2.4s ease-in-out infinite',
        'pulse-seam': 'pulse-seam 2.2s ease-in-out infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
        breathe: 'breathe 7s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
