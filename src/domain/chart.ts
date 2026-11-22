export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartLayout {
  points: ChartPoint[];
  min: number;
  max: number;
}

/**
 * Width in px to reserve left of the plot for right-aligned y-axis labels.
 * Estimates text width as fontSize × 0.6 per character (digits, '.', ' ', 'kg') plus a gap,
 * so even the largest possible e1RM label ("2166.7 kg") is not clipped.
 */
export function yLabelWidth(labels: string[], fontSize: number, gap = 8): number {
  const longest = labels.reduce((n, l) => Math.max(n, l.length), 0);
  return Math.ceil(longest * fontSize * 0.6) + gap;
}

/**
 * Maps values to pixel positions inside the box [left..left+width] x [top..top+height].
 * x evenly spaced (a single value is centred); larger values are higher (smaller y).
 * All values equal -> a flat line in the vertical middle (no divide by zero).
 */
export function layoutChart(
  values: number[],
  box: { left: number; top: number; width: number; height: number },
): ChartLayout {
  if (values.length === 0) return { points: [], min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const n = values.length;
  const points = values.map((v, i) => ({
    x: n === 1 ? box.left + box.width / 2 : box.left + (box.width * i) / (n - 1),
    y: range === 0 ? box.top + box.height / 2 : box.top + box.height * (1 - (v - min) / range),
  }));
  return { points, min, max };
}
