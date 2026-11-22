import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../src/repos/exerciseRepo';
import { pickerSections } from '../../src/services/exercisePicker';

const ex = (id: number, name: string, muscle_group: Exercise['muscle_group']): Exercise => ({
  id,
  name,
  muscle_group,
  is_builtin: true,
});

const all = [
  ex(1, 'Barbell Bench Press', 'chest'),
  ex(2, 'Lat Pulldown', 'back'),
  ex(3, 'Barbell Curl', 'biceps'),
  ex(4, 'Leg Press', 'quads'),
  ex(5, 'Incline Dumbbell Press', 'chest'),
];

describe('pickerSections (E1)', () => {
  it('groups in muscle-group order and keeps exercise order', () => {
    const s = pickerSections(all, '');
    expect(s.map((x) => x.group)).toEqual(['chest', 'back', 'biceps', 'quads']);
    expect(s[0].exercises.map((e) => e.id)).toEqual([1, 5]);
  });
  it('filters by name, case-insensitive and trimmed, dropping empty sections', () => {
    const s = pickerSections(all, '  PRESS ');
    expect(s.map((x) => x.group)).toEqual(['chest', 'quads']);
    expect(s[0].exercises.map((e) => e.id)).toEqual([1, 5]);
  });
  it('returns nothing when nothing matches', () => {
    expect(pickerSections(all, 'zzz')).toEqual([]);
  });
});
