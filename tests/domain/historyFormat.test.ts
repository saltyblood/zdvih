import { describe, expect, it } from 'vitest';

import { formatHistoryRow, formatProgressRow } from '../../src/domain/historyFormat';
import { e1rmCg } from '../../src/domain/oneRepMax';

const t = new Date(2026, 10, 20, 14, 30).getTime();

describe('formatHistoryRow', () => {
  it('matches 5.1a with a thousands separator', () => {
    expect(
      formatHistoryRow({ startedAt: t, durationMinutes: 62, setCount: 18, volumeCg: 845000 }),
    ).toBe('Fri, 20 Nov 2026 · 14:30 · 62 min · 18 sets · 8,450 kg');
  });
  it('uses singular for one set', () => {
    expect(
      formatHistoryRow({ startedAt: t, durationMinutes: 3, setCount: 1, volumeCg: 8000 }),
    ).toBe('Fri, 20 Nov 2026 · 14:30 · 3 min · 1 set · 80 kg');
  });
});

describe('formatProgressRow', () => {
  it('formats best set and e1RM (D7)', () => {
    expect(
      formatProgressRow({
        startedAt: t,
        best: { weight_cg: 10000, reps: 5 },
        e1rmCg: e1rmCg(10000, 5),
      }),
    ).toBe('Fri, 20 Nov 2026 — best set 100 kg × 5 — e1RM 116.7 kg');
  });
});
