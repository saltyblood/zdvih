import { describe, expect, it } from 'vitest';

import { layoutChart, yLabelWidth } from '../../src/domain/chart';
import { e1rmCg, formatE1rm } from '../../src/domain/oneRepMax';

const box = { left: 10, top: 0, width: 100, height: 50 };

describe('layoutChart', () => {
  it('spaces x evenly and maps min to bottom, max to top', () => {
    const { points, min, max } = layoutChart([100, 150, 200], box);
    expect(min).toBe(100);
    expect(max).toBe(200);
    expect(points.map((p) => p.x)).toEqual([10, 60, 110]);
    expect(points.map((p) => p.y)).toEqual([50, 25, 0]);
  });
  it('handles all-equal values without NaN', () => {
    const { points } = layoutChart([5, 5, 5], box);
    expect(points.every((p) => p.y === 25 && Number.isFinite(p.x))).toBe(true);
  });
  it('centres a single value and handles empty input', () => {
    expect(layoutChart([7], box).points).toEqual([{ x: 60, y: 25 }]);
    expect(layoutChart([], box).points).toEqual([]);
  });
});

describe('yLabelWidth', () => {
  it('reserves room for the widest label, incl. the largest possible e1RM', () => {
    const widest = formatE1rm(e1rmCg(50000, 100)); // 500 kg × 100 reps
    expect(widest).toBe('2166.7 kg');
    const w = yLabelWidth([widest, formatE1rm(8000)], 11, 10);
    // 9 chars × 11 px × 0.6 = 59.4 -> 60, plus the gap
    expect(w).toBe(70);
  });

  it('is just the gap for no labels', () => {
    expect(yLabelWidth([], 11, 8)).toBe(8);
  });
});
