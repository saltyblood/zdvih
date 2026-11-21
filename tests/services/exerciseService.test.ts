import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { createExerciseService } from '../../src/services/exerciseService';
import { createSqlJsDb } from '../support/sqljsDb';

let db: Db;
let svc: ReturnType<typeof createExerciseService>;
beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
  svc = createExerciseService({ db });
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

describe('exercise list (4.1a)', () => {
  it('has 14 built-ins in 7 groups in design order', async () => {
    const list = await svc.list();
    expect(list.map((e) => [e.muscle_group, e.name])).toEqual([
      ['chest', 'Barbell Bench Press'],
      ['chest', 'Incline Dumbbell Press'],
      ['back', 'Lat Pulldown'],
      ['back', 'Seated Cable Row'],
      ['shoulders', 'Overhead Barbell Press'],
      ['shoulders', 'Dumbbell Lateral Raise'],
      ['biceps', 'Barbell Curl'],
      ['biceps', 'Dumbbell Hammer Curl'],
      ['triceps', 'Cable Triceps Pushdown'],
      ['triceps', 'Overhead Dumbbell Triceps Extension'],
      ['quads', 'Barbell Back Squat'],
      ['quads', 'Leg Press'],
      ['hamstrings_glutes', 'Romanian Deadlift'],
      ['hamstrings_glutes', 'Lying Leg Curl'],
    ]);
    expect(new Set(list.map((e) => e.muscle_group)).size).toBe(7);
    expect(list.every((e) => e.is_builtin)).toBe(true);
  });

  it('puts custom exercises after built-ins of their group, sorted by name', async () => {
    await svc.create('Zottman Curl', 'biceps');
    await svc.create('Chin-up', 'back');
    await svc.create('Concentration Curl', 'biceps');
    const list = await svc.list();
    expect(list.map((e) => e.name)).toEqual([
      'Barbell Bench Press',
      'Incline Dumbbell Press',
      'Lat Pulldown',
      'Seated Cable Row',
      'Chin-up',
      'Overhead Barbell Press',
      'Dumbbell Lateral Raise',
      'Barbell Curl',
      'Dumbbell Hammer Curl',
      'Concentration Curl',
      'Zottman Curl',
      'Cable Triceps Pushdown',
      'Overhead Dumbbell Triceps Extension',
      'Barbell Back Squat',
      'Leg Press',
      'Romanian Deadlift',
      'Lying Leg Curl',
    ]);
  });
});

describe('delete built-in (4.1b)', () => {
  it('rejects with EXERCISE_BUILTIN', async () => {
    const [first] = await svc.list();
    expect(await svc.canDelete(first.id)).toBe(false);
    expect(await code(svc.delete(first.id))).toBe('EXERCISE_BUILTIN');
    expect(await svc.list()).toHaveLength(14);
  });
});

describe('create (4.2a, 4.2b)', () => {
  it('rejects empty, blank and 61-character names', async () => {
    expect(await code(svc.create('', 'chest'))).toBe('NAME_INVALID');
    expect(await code(svc.create('   ', 'chest'))).toBe('NAME_INVALID');
    expect(await code(svc.create('a'.repeat(61), 'chest'))).toBe('NAME_INVALID');
  });

  it('accepts 60 characters and trims on save', async () => {
    const long = await svc.create('a'.repeat(60), 'chest');
    expect(long.name).toHaveLength(60);
    const ex = await svc.create('  Cable Fly  ', 'chest');
    expect(ex.name).toBe('Cable Fly');
    const row = await db.first<{ name: string; name_key: string; is_builtin: number }>(
      'SELECT name, name_key, is_builtin FROM exercises WHERE id = ?',
      [ex.id],
    );
    expect(row).toEqual({ name: 'Cable Fly', name_key: 'cable fly', is_builtin: 0 });
  });

  it('rejects an unknown muscle group', async () => {
    expect(await code(svc.create('Foo', 'calves' as never))).toBe('NAME_INVALID');
  });

  it('rejects duplicates case-insensitively after trimming', async () => {
    expect(await code(svc.create(' barbell curl ', 'biceps'))).toBe('EXERCISE_EXISTS');
    await svc.create('My Move', 'back');
    expect(await code(svc.create('MY MOVE', 'chest'))).toBe('EXERCISE_EXISTS');
  });
});

describe('delete custom (4.2c)', () => {
  it('refuses a custom exercise that has sets, deletes an unused one', async () => {
    const used = await svc.create('Used Move', 'back');
    const unused = await svc.create('Unused Move', 'back');
    const w = await db.run('INSERT INTO workouts (started_at, last_activity_at) VALUES (1, 1)');
    await db.run(
      'INSERT INTO sets (workout_id, exercise_id, weight_cg, reps, position, created_at) VALUES (?, ?, 5000, 8, 1, 1)',
      [w.lastInsertRowId, used.id],
    );

    expect(await svc.canDelete(used.id)).toBe(false);
    expect(await code(svc.delete(used.id))).toBe('EXERCISE_IN_USE');

    expect(await svc.canDelete(unused.id)).toBe(true);
    await svc.delete(unused.id);
    expect((await svc.list()).some((e) => e.id === unused.id)).toBe(false);
    expect((await svc.list()).some((e) => e.id === used.id)).toBe(true);
  });

  it('returns NOT_FOUND for an unknown id', async () => {
    expect(await code(svc.delete(9999))).toBe('NOT_FOUND');
    expect(await svc.canDelete(9999)).toBe(false);
  });
});
