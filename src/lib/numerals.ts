/** Eastern Arabic numerals, for anything shown inside the Arabic reading flow. */
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function arabicNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

/**
 * A fixed-point value inside Arabic prose: ٠٫٥٠, with the Arabic decimal
 * separator (U+066B) rather than a full stop, which reads as a sentence end
 * in an RTL line.
 */
export function arabicDecimal(n: number, places = 2): string {
  return n.toFixed(places).replace(/\d/g, (d) => AR_DIGITS[Number(d)]).replace('.', '\u066B');
}

/** Person names, so prose never prints a bare 1, 2 or 3 at the reader. */
export const PERSON_NAME: Record<number, string> = {
  1: 'المتكلم',
  2: 'المخاطب',
  3: 'الغائب',
};
