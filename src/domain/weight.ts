import { AppError } from './errors';

const WEIGHT_RE = /^\d{1,3}([.,]\d{1,2})?$/;
const MAX_WEIGHT_CG = 50000;

/** Parses user input ("102,5") to integer centi-kilograms (10250) using string arithmetic only (S1). */
export function parseWeight(input: string): number {
  const text = input.trim();
  if (!WEIGHT_RE.test(text)) throw new AppError('WEIGHT_INVALID');
  const [whole, fraction = ''] = text.replace(',', '.').split('.');
  const cg = parseInt(whole, 10) * 100 + parseInt(fraction.padEnd(2, '0') || '0', 10);
  if (cg < 1 || cg > MAX_WEIGHT_CG) throw new AppError('WEIGHT_INVALID');
  return cg;
}

/** 10250 -> "102.5 kg", 10000 -> "100 kg", 10025 -> "100.25 kg". */
export function formatKg(cg: number): string {
  const whole = Math.floor(cg / 100);
  const fraction = String(cg % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return `${whole}${fraction ? '.' + fraction : ''} kg`;
}
