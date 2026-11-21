import { describe, expect, it } from 'vitest';
import { durationMinutes, formatCountdown, formatDate, formatTime } from '../../src/domain/time';

// Local-time constructor, so the tests are independent of the machine time zone.
const local = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).getTime();

describe('formatDate', () => {
  it('formats weekday, day, month and year', () => {
    expect(formatDate(local(2026, 11, 20, 14, 30))).toBe('Fri, 20 Nov 2026');
    expect(formatDate(local(2026, 1, 5))).toBe('Mon, 5 Jan 2026');
  });
});

describe('formatTime', () => {
  it('formats 24-hour time with zero padding', () => {
    expect(formatTime(local(2026, 11, 20, 14, 30))).toBe('14:30');
    expect(formatTime(local(2026, 11, 20, 7, 5))).toBe('07:05');
    expect(formatTime(local(2026, 11, 20, 0, 0))).toBe('00:00');
  });
});

describe('durationMinutes', () => {
  it('floors to whole minutes', () => {
    expect(durationMinutes(0, 62 * 60000)).toBe(62);
    expect(durationMinutes(0, 62 * 60000 + 59999)).toBe(62);
    expect(durationMinutes(0, 59999)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats m:ss', () => {
    expect(formatCountdown(180)).toBe('3:00');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(167)).toBe('2:47');
    expect(formatCountdown(0)).toBe('0:00');
  });
});
