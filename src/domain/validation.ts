import { AppError } from './errors';

const REPS_RE = /^\d{1,3}$/;
const NAME_MAX = 60;

/** Whole reps 1..100 (S2). */
export function parseReps(input: string): number {
  const text = input.trim();
  if (!REPS_RE.test(text)) throw new AppError('REPS_INVALID');
  const reps = parseInt(text, 10);
  if (reps < 1 || reps > 100) throw new AppError('REPS_INVALID');
  return reps;
}

/** Trim, 1-60 characters (E2); key is the lower-cased trimmed name. */
export function normalizeExerciseName(input: string): { name: string; key: string } {
  const name = input.trim();
  if (name.length < 1 || name.length > NAME_MAX) throw new AppError('NAME_INVALID');
  return { name, key: name.toLowerCase() };
}
