/** Sum of weight_cg x reps. Volume in kg is this value / 100. */
export function volumeCg(sets: { weight_cg: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + s.weight_cg * s.reps, 0);
}

/** Volume for display, e.g. 845000 -> "8,450 kg" (thousands separator ","). */
export function formatVolume(cg: number): string {
  const kg = Math.round(cg / 100);
  return `${String(kg).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} kg`;
}
