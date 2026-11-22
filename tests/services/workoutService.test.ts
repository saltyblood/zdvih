import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { REMINDER_SECONDS } from '../../src/config';
import { createWorkoutService } from '../../src/services/workoutService';
import { strings } from '../../src/strings';
import { createSqlJsDb } from '../support/sqljsDb';
import { FakeClock, FakeNotifier } from '../support/fakes';

const BENCH = 1; // Barbell Bench Press (seed)
const SQUAT = 11; // Barbell Back Squat (seed)
const MIN = 60_000;

let db: Db;
let notifier: FakeNotifier;
let clock: FakeClock;
let svc: ReturnType<typeof createWorkoutService>;

const make = () => createWorkoutService({ db, notifier, clock });

beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
  notifier = new FakeNotifier();
  clock = new FakeClock();
  svc = make();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

/** Runs a complete workout through the service and returns its id. */
async function finishedWorkout(sets: [number, string, string][], minutes = 30): Promise<number> {
  const w = await svc.startWorkout();
  for (const [ex, wt, reps] of sets) await svc.addSet(ex, wt, reps);
  clock.advance(minutes * MIN);
  await svc.finishWorkout();
  clock.advance(24 * 60 * MIN);
  return w.id;
}

describe('start (1.1a, 1.1b)', () => {
  it('creates an active workout at clock.now()', async () => {
    const w = await svc.startWorkout();
    const active = await svc.getActive();
    expect(active?.id).toBe(w.id);
    expect(active?.started_at).toBe(clock.now());
    expect(active?.finished_at).toBeNull();
    expect(active?.last_activity_at).toBe(clock.now());
  });

  it('rejects a second start and the DB itself rejects a second active row', async () => {
    await svc.startWorkout();
    expect(await code(svc.startWorkout())).toBe('WORKOUT_ALREADY_ACTIVE');
    await expect(
      db.run('INSERT INTO workouts (started_at, last_activity_at) VALUES (1, 1)'),
    ).rejects.toThrow();
  });
});

describe('finish (1.2a, 1.2b)', () => {
  it('stores a workout with sets in history with duration 62', async () => {
    await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    clock.advance(62 * MIN);
    const res = await svc.finishWorkout();
    expect(res.discarded).toBe(false);
    expect(await svc.getActive()).toBeNull();
    const hist = await svc.history();
    expect(hist).toHaveLength(1);
    expect(hist[0].durationMinutes).toBe(62);
    expect(hist[0].setCount).toBe(1);
    const row = await db.first<{
      rest_ends_at: number | null;
      rest_notification_id: string | null;
      reminder_notification_id: string | null;
    }>('SELECT rest_ends_at, rest_notification_id, reminder_notification_id FROM workouts');
    expect(row).toEqual({
      rest_ends_at: null,
      rest_notification_id: null,
      reminder_notification_id: null,
    });
  });

  it('deletes a workout without sets', async () => {
    await svc.startWorkout();
    const res = await svc.finishWorkout();
    expect(res.discarded).toBe(true);
    expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workouts'))?.n).toBe(0);
    expect(await svc.history()).toEqual([]);
    expect(await svc.getActive()).toBeNull();
  });

  it('cancels the rest notification too and fails without an active workout', async () => {
    const w = await svc.startWorkout();
    await db.run(
      "UPDATE workouts SET rest_ends_at = ?, rest_notification_id = 'rest-1' WHERE id = ?",
      [clock.now() + 180_000, w.id],
    );
    await svc.addSet(BENCH, '50', '5');
    await svc.finishWorkout();
    expect(notifier.cancelled).toContain('rest-1');
    expect(await code(svc.finishWorkout())).toBe('NO_ACTIVE_WORKOUT');
  });
});

describe('persistence (1.3a)', () => {
  it('a new service instance on the same DB sees the same workout and sets', async () => {
    const w = await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    await svc.addSet(SQUAT, '100', '5');
    const again = make();
    const active = await again.getActive();
    expect(active?.id).toBe(w.id);
    expect(active?.sets.map((s) => [s.exercise_id, s.weight_cg, s.reps])).toEqual([
      [BENCH, 8000, 8],
      [SQUAT, 10000, 5],
    ]);
  });
});

describe('inactivity reminder (1.5a-1.5d)', () => {
  it('1.5a: start schedules a reminder after REMINDER_SECONDS (1800)', async () => {
    const w = await svc.startWorkout();
    expect(REMINDER_SECONDS).toBe(1800);
    expect(notifier.scheduled).toHaveLength(1);
    expect(notifier.scheduled[0]).toMatchObject({
      kind: 'reminder',
      seconds: 1800,
      title: strings.notifications.reminderTitle,
      body: strings.notifications.reminderBody,
    });
    const row = await db.first<{ reminder_notification_id: string | null }>(
      'SELECT reminder_notification_id FROM workouts WHERE id = ?',
      [w.id],
    );
    expect(row?.reminder_notification_id).toBe(notifier.scheduled[0].id);
  });

  it('1.5b: activity cancels the previous reminder and keeps exactly one pending', async () => {
    const w = await svc.startWorkout();
    const first = notifier.scheduled[0].id as string;
    clock.advance(5 * MIN);
    await svc.addSet(BENCH, '80', '8');
    expect(notifier.cancelled).toEqual([first]);
    expect(notifier.pending('reminder')).toHaveLength(1);
    const second = notifier.pending('reminder')[0].id;
    expect(second).not.toBe(first);

    const s = await db.first<{ id: number }>('SELECT id FROM sets');
    await svc.updateSet((s as { id: number }).id, '82.5', '8');
    await svc.deleteSet((s as { id: number }).id);
    expect(notifier.pending('reminder')).toHaveLength(1);

    const row = await db.first<{ reminder_notification_id: string; last_activity_at: number }>(
      'SELECT reminder_notification_id, last_activity_at FROM workouts WHERE id = ?',
      [w.id],
    );
    expect(row?.reminder_notification_id).toBe(notifier.pending('reminder')[0].id);
    expect(row?.last_activity_at).toBe(clock.now());
  });

  it('1.5c: the reminder never changes the workout; duration counts the full time', async () => {
    const w = await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    clock.advance(45 * MIN); // reminder time passes
    const active = await svc.getActive();
    expect(active?.id).toBe(w.id);
    expect(active?.finished_at).toBeNull();
    expect(active?.sets).toHaveLength(1);
    clock.advance(15 * MIN);
    await svc.finishWorkout();
    expect((await svc.history())[0].durationMinutes).toBe(60);
  });

  it('1.5d: finish cancels the reminder', async () => {
    await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    const pending = notifier.pending('reminder')[0].id as string;
    await svc.finishWorkout();
    expect(notifier.cancelled).toContain(pending);
    expect(notifier.pending()).toHaveLength(0);
  });

  it('works with denied permission (id stays NULL)', async () => {
    notifier.granted = false;
    const w = await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    const row = await db.first<{ reminder_notification_id: string | null }>(
      'SELECT reminder_notification_id FROM workouts WHERE id = ?',
      [w.id],
    );
    expect(row?.reminder_notification_id).toBeNull();
    expect(await svc.getActive()).not.toBeNull();
  });
});

describe('sets (2.1d, 2.3a, 3.1d)', () => {
  it('2.1d: positions 1, 2, 3 in order', async () => {
    await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    await svc.addSet(SQUAT, '100', '5');
    await svc.addSet(BENCH, '82,5', '6');
    const active = await svc.getActive();
    expect(active?.sets.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(active?.sets.map((s) => s.weight_cg)).toEqual([8000, 10000, 8250]);
  });

  it('addSet requires an active workout, a valid input and an existing exercise', async () => {
    expect(await code(svc.addSet(BENCH, '80', '8'))).toBe('NO_ACTIVE_WORKOUT');
    await svc.startWorkout();
    expect(await code(svc.addSet(BENCH, '0', '8'))).toBe('WEIGHT_INVALID');
    expect(await code(svc.addSet(BENCH, '80', '0'))).toBe('REPS_INVALID');
    expect(await code(svc.addSet(9999, '80', '8'))).toBe('NOT_FOUND');
    expect((await svc.getActive())?.sets).toHaveLength(0);
  });

  it('2.3a: update validates, delete removes, finished-workout sets are NOT_FOUND', async () => {
    await svc.startWorkout();
    const s = await svc.addSet(BENCH, '80', '8');
    expect(await code(svc.updateSet(s.id, '1.234', '8'))).toBe('WEIGHT_INVALID');
    expect(await code(svc.updateSet(s.id, '80', '101'))).toBe('REPS_INVALID');
    const upd = await svc.updateSet(s.id, '85', '6');
    expect([upd.weight_cg, upd.reps]).toEqual([8500, 6]);

    const s2 = await svc.addSet(BENCH, '60', '10');
    await svc.deleteSet(s2.id);
    expect((await svc.getActive())?.sets.map((x) => x.id)).toEqual([s.id]);
    expect(await code(svc.deleteSet(s2.id))).toBe('NOT_FOUND');

    await svc.finishWorkout();
    expect(await code(svc.updateSet(s.id, '80', '8'))).toBe('NOT_FOUND');
    expect(await code(svc.deleteSet(s.id))).toBe('NOT_FOUND');
  });

  it('3.1d: addSet leaves the rest columns untouched', async () => {
    const w = await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8'); // rest idle
    const idle = await db.first<{ r: number | null; n: string | null }>(
      'SELECT rest_ends_at AS r, rest_notification_id AS n FROM workouts WHERE id = ?',
      [w.id],
    );
    expect(idle).toEqual({ r: null, n: null });

    const endsAt = clock.now() + 100_000;
    await db.run(
      "UPDATE workouts SET rest_ends_at = ?, rest_notification_id = 'rest-x' WHERE id = ?",
      [endsAt, w.id],
    );
    const s = await svc.addSet(BENCH, '80', '8');
    await svc.updateSet(s.id, '81', '8');
    await svc.deleteSet(s.id);
    const running = await db.first<{ r: number | null; n: string | null }>(
      'SELECT rest_ends_at AS r, rest_notification_id AS n FROM workouts WHERE id = ?',
      [w.id],
    );
    expect(running).toEqual({ r: endsAt, n: 'rest-x' });
    expect(notifier.cancelled).not.toContain('rest-x');
  });
});

describe('previous sets (2.2a-2.2c)', () => {
  it('2.2a: returns the sets and date of the newer finished workout', async () => {
    await finishedWorkout([[BENCH, '60', '10']]);
    const newer = clock.now();
    await finishedWorkout([
      [BENCH, '80', '8'],
      [SQUAT, '100', '5'],
      [BENCH, '82.5', '6'],
    ]);
    const prev = await svc.previousSets(BENCH);
    expect(prev?.workoutStartedAt).toBe(newer);
    expect(prev?.sets.map((s) => [s.weight_cg, s.reps, s.position])).toEqual([
      [8000, 8, 1],
      [8250, 6, 3],
    ]);
  });

  it('2.2a: ignores the active workout', async () => {
    await finishedWorkout([[BENCH, '60', '10']]);
    await svc.startWorkout();
    await svc.addSet(BENCH, '90', '3');
    const prev = await svc.previousSets(BENCH);
    expect(prev?.sets.map((s) => s.weight_cg)).toEqual([6000]);
  });

  it('2.2b: null for an unused exercise', async () => {
    await finishedWorkout([[BENCH, '60', '10']]);
    expect(await svc.previousSets(SQUAT)).toBeNull();
  });

  it('2.2c: prefill (last set of the list) equals the last set of the previous workout', async () => {
    await finishedWorkout([
      [BENCH, '80', '8'],
      [BENCH, '82.5', '6'],
    ]);
    const prev = await svc.previousSets(BENCH);
    const last = prev?.sets[prev.sets.length - 1];
    expect([last?.weight_cg, last?.reps]).toEqual([8250, 6]);
  });
});

describe('history and detail (5.1a, 5.2a)', () => {
  it('5.1a: newest first with set count and volume', async () => {
    const a = await finishedWorkout([
      [BENCH, '100', '5'],
      [BENCH, '100', '5'],
    ]);
    const b = await finishedWorkout([[SQUAT, '120', '3']]);
    const c = await finishedWorkout([
      [BENCH, '50', '10'],
      [SQUAT, '60.5', '2'],
      [SQUAT, '60.5', '2'],
    ]);
    const hist = await svc.history();
    expect(hist.map((h) => h.id)).toEqual([c, b, a]);
    expect(hist.map((h) => h.setCount)).toEqual([3, 1, 2]);
    expect(hist.map((h) => h.volumeCg)).toEqual([50000 + 12100 + 12100, 36000, 100000]);
    expect(hist.every((h) => h.durationMinutes === 30)).toBe(true);
  });

  it('5.1a: the active workout is not in history', async () => {
    await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    expect(await svc.history()).toEqual([]);
  });

  it('5.2a: detail groups sets by exercise in position order', async () => {
    const id = await finishedWorkout([
      [BENCH, '80', '8'],
      [SQUAT, '100', '5'],
      [BENCH, '82.5', '6'],
    ]);
    const d = await svc.workoutDetail(id);
    expect(d.groups.map((g) => g.exerciseName)).toEqual([
      'Barbell Bench Press',
      'Barbell Back Squat',
    ]);
    expect(d.groups[0].sets.map((s) => [s.position, s.weight_cg, s.reps])).toEqual([
      [1, 8000, 8],
      [3, 8250, 6],
    ]);
    expect(d.groups[1].sets.map((s) => s.position)).toEqual([2]);
    expect(d.setCount).toBe(3);
    expect(await code(svc.workoutDetail(9999))).toBe('NOT_FOUND');
  });
});

describe('progress (5.3a)', () => {
  it('3 workouts give 3 points ASC, each the best set e1RM', async () => {
    await finishedWorkout([
      [BENCH, '100', '5'],
      [BENCH, '90', '5'],
    ]);
    await finishedWorkout([
      [BENCH, '80', '1'],
      [SQUAT, '200', '10'],
    ]);
    await finishedWorkout([
      [BENCH, '60', '10'],
      [BENCH, '70', '8'],
    ]);
    const p = await svc.progress(BENCH);
    expect(p).toHaveLength(3);
    expect(p[0].startedAt).toBeLessThan(p[1].startedAt);
    expect(p[1].startedAt).toBeLessThan(p[2].startedAt);
    expect(p[0].best).toEqual({ weight_cg: 10000, reps: 5 });
    expect(p[0].e1rmCg).toBeCloseTo(11666.67, 1);
    expect(p[1].best).toEqual({ weight_cg: 8000, reps: 1 });
    expect(p[1].e1rmCg).toBe(8000);
    // 60x10 -> 8000, 70x8 -> 8866.67
    expect(p[2].best).toEqual({ weight_cg: 7000, reps: 8 });
    expect(p[2].e1rmCg).toBeCloseTo(8866.67, 1);
    expect(await svc.progress(1000)).toEqual([]);
  });

  it('ignores the active workout', async () => {
    await finishedWorkout([[BENCH, '100', '5']]);
    await svc.startWorkout();
    await svc.addSet(BENCH, '200', '5');
    expect(await svc.progress(BENCH)).toHaveLength(1);
  });
});

describe('delete workout (5.4a)', () => {
  it('removes workout and sets; previousSets and progress no longer include it', async () => {
    const a = await finishedWorkout([[BENCH, '60', '10']]);
    const b = await finishedWorkout([[BENCH, '80', '8']]);
    await svc.deleteWorkout(b);
    expect(
      (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sets WHERE workout_id = ?', [b]))?.n,
    ).toBe(0);
    expect((await svc.history()).map((h) => h.id)).toEqual([a]);
    expect((await svc.previousSets(BENCH))?.sets.map((s) => s.weight_cg)).toEqual([6000]);
    expect(await svc.progress(BENCH)).toHaveLength(1);
  });

  it('NOT_FOUND for unknown ids and for the active workout', async () => {
    expect(await code(svc.deleteWorkout(9999))).toBe('NOT_FOUND');
    const w = await svc.startWorkout();
    expect(await code(svc.deleteWorkout(w.id))).toBe('NOT_FOUND');
    expect(await svc.getActive()).not.toBeNull();
  });
});
