import { strings } from '../strings';
import { formatE1rm } from './oneRepMax';
import { formatDate, formatTime } from './time';
import { formatKg } from './weight';
import { formatVolume } from './volume';

export interface HistoryRowInput {
  startedAt: number;
  durationMinutes: number;
  setCount: number;
  volumeCg: number;
}

/** 5.1a: "Fri, 20 Nov 2026 · 14:30 · 62 min · 18 sets · 8,450 kg" */
export function formatHistoryRow(item: HistoryRowInput): string {
  const t = strings.history;
  return [
    formatDate(item.startedAt),
    formatTime(item.startedAt),
    `${item.durationMinutes} ${t.min}`,
    `${item.setCount} ${item.setCount === 1 ? t.set : t.sets}`,
    formatVolume(item.volumeCg),
  ].join(' · ');
}

/** 5.3: "Fri, 20 Nov 2026 — best set 100 kg × 5 — e1RM 116.7 kg" */
export function formatProgressRow(p: {
  startedAt: number;
  best: { weight_cg: number; reps: number };
  e1rmCg: number;
}): string {
  const t = strings.history;
  return `${formatDate(p.startedAt)} — ${t.bestSet} ${formatKg(p.best.weight_cg)} × ${p.best.reps} — ${t.e1rm} ${formatE1rm(p.e1rmCg)}`;
}
