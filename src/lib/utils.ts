import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { arabicNumber } from './numerals';
export { arabicNumber, arabicDecimal, PERSON_NAME } from './numerals';

/** Percentages are read inside Arabic prose, so they carry Arabic digits. */
export function pct(n: number): string {
  return `${arabicNumber(Math.round(n * 100))}٪`;
}
