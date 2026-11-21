/** Epley estimated 1RM in centi-kg (float) (D7). */
export function e1rmCg(weightCg: number, reps: number): number {
  return reps === 1 ? weightCg : weightCg * (1 + reps / 30);
}

/** Always one decimal: "116.7 kg", "80.0 kg". */
export function formatE1rm(cg: number): string {
  const tenths = Math.round(cg / 10);
  return `${Math.floor(tenths / 10)}.${tenths % 10} kg`;
}

/** Set with the highest e1RM; ties go to the earliest position. */
export function bestSet<T extends { weight_cg: number; reps: number; position: number }>(
  sets: T[],
): T {
  if (sets.length === 0) throw new Error('bestSet requires at least one set');
  let best = sets[0];
  let bestValue = e1rmCg(best.weight_cg, best.reps);
  for (const s of sets.slice(1)) {
    const value = e1rmCg(s.weight_cg, s.reps);
    if (value > bestValue || (value === bestValue && s.position < best.position)) {
      best = s;
      bestValue = value;
    }
  }
  return best;
}
