import { AppError, type ErrorCode } from './errors';
import { parseReps } from './validation';
import { parseWeight } from './weight';

export interface SetInputState {
  /** S1/S2 errors, only for non-empty fields (an empty field is not an error yet). */
  weightError: ErrorCode | null;
  repsError: ErrorCode | null;
  /** both fields parse (2.1a) */
  canSave: boolean;
}

function check(input: string, parse: (s: string) => number): { ok: boolean; error: ErrorCode | null } {
  try {
    parse(input);
    return { ok: true, error: null };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: input.trim() === '' ? null : e.code };
    throw e;
  }
}

/** Derives inline errors and the "Save set" enabled state from the raw field texts (2.1a-c). */
export function validateSetInput(weightInput: string, repsInput: string): SetInputState {
  const w = check(weightInput, parseWeight);
  const r = check(repsInput, parseReps);
  return { weightError: w.error, repsError: r.error, canSave: w.ok && r.ok };
}

/** Centi-kg as text for the weight field: 8000 -> "80", 10250 -> "102.5", 10025 -> "100.25". */
export function weightInputText(cg: number): string {
  const whole = Math.floor(cg / 100);
  const fraction = String(cg % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return `${whole}${fraction ? '.' + fraction : ''}`;
}
