import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { createRestService } from '../../src/services/restService';
import { createWorkoutService } from '../../src/services/workoutService';
import { strings } from '../../src/strings';
import { createSqlJsDb } from '../support/sqljsDb';
import { FakeClock, FakeNotifier, deferred } from '../support/fakes';

const BENCH = 1;
const REST = 180;
const SEC = 1000;

let db: Db;
let notifier: FakeNotifier;
let clock: FakeClock;
let work: ReturnType<typeof createWorkoutService>;
let rest: ReturnType<typeof createRestService>;

const tick = () => new Promise((r) => setTimeout(r, 0));
const state = () =>
  db.first<{
    finished_at: number | null;
    rest_ends_at: number | null;
    rest_notification_id: string | null;
    reminder_notification_id: string | null;
  }>('SELECT * FROM workouts');
const restSchedules = () => notifier.scheduled.filter((s) => s.kind === 'rest');

beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
  notifier = new FakeNotifier();
  clock = new FakeClock();
  work = createWorkoutService({ db, notifier, clock });
  rest = createRestService({ db, notifier, clock, restSeconds: REST });
});

describe('automatic start (3.1a, 3.1b, 3.1e)', () => {
  it('3.1a: onPickup with an active workout starts a 180 s rest', async () => {
    await work.startWorkout();
    await rest.onPickup();
    const s = await state();
    expect(s?.rest_ends_at).toBe(clock.now() + REST * SEC);
    expect(restSchedules()).toHaveLength(1);
    expect(await rest.remainingSeconds()).toBe(REST);
  });

  it('3.1b: onPickup while a rest runs changes nothing and schedules nothing', async () => {
    await work.startWorkout();
    await rest.startRest();
    const before = await state();
    clock.advance(30 * SEC);
    await rest.onPickup();
    const after = await state();
    expect(after?.rest_ends_at).toBe(before?.rest_ends_at);
    expect(after?.rest_notification_id).toBe(before?.rest_notification_id);
    expect(restSchedules()).toHaveLength(1);
  });

  it('3.1e: onPickup without an active workout does nothing', async () => {
    await rest.onPickup();
    expect(notifier.scheduled).toHaveLength(0);
  });

  it('onPickup after the previous rest expired (not yet cleared) starts a new rest', async () => {
    await work.startWorkout();
    await rest.startRest();
    clock.advance((REST + 5) * SEC);
    await rest.onPickup();
    expect((await state())?.rest_ends_at).toBe(clock.now() + REST * SEC);
    expect(restSchedules()).toHaveLength(2);
  });
});

describe('3.1d addSet does not touch the rest timer', () => {
  it('while running: rest_ends_at unchanged', async () => {
    await work.startWorkout();
    await rest.startRest();
    const before = await state();
    clock.advance(10 * SEC);
    await work.addSet(BENCH, '80', '8');
    const after = await state();
    expect(after?.rest_ends_at).toBe(before?.rest_ends_at);
    expect(after?.rest_notification_id).toBe(before?.rest_notification_id);
    expect(restSchedules()).toHaveLength(1);
  });

  it('while idle: still idle', async () => {
    await work.startWorkout();
    await work.addSet(BENCH, '80', '8');
    expect((await state())?.rest_ends_at).toBeNull();
    expect(restSchedules()).toHaveLength(0);
  });
});

describe('T1 startRest (3.2a, 3.4b, 3.4c, 3.4d)', () => {
  it('requires an active workout', async () => {
    await expect(rest.startRest()).rejects.toMatchObject({ code: 'NO_ACTIVE_WORKOUT' });
  });

  it('3.4b: schedules kind rest for 180 s with the texts', async () => {
    await work.startWorkout();
    await rest.startRest();
    expect(restSchedules()).toEqual([
      {
        id: expect.any(String),
        kind: 'rest',
        seconds: 180,
        title: strings.notifications.restTitle,
        body: strings.notifications.restBody,
      },
    ]);
    expect((await state())?.rest_notification_id).toBe(restSchedules()[0].id);
  });

  it('3.2a/3.4c: restart after 60 s cancels the old id and sets rest_ends_at = now + 180 s', async () => {
    await work.startWorkout();
    await rest.startRest();
    const first = (await state())?.rest_notification_id;
    clock.advance(60 * SEC);
    await rest.startRest();
    const s = await state();
    expect(notifier.cancelled).toContain(first);
    expect(s?.rest_ends_at).toBe(clock.now() + REST * SEC);
    expect(notifier.pending('rest')).toHaveLength(1);
    expect(s?.rest_notification_id).toBe(notifier.pending('rest')[0].id);
  });

  it('is an activity: refreshes the reminder', async () => {
    await work.startWorkout();
    const reminder = (await state())?.reminder_notification_id;
    clock.advance(1000);
    await rest.startRest();
    expect(notifier.cancelled).toContain(reminder);
    expect(notifier.pending('reminder')).toHaveLength(1);
  });

  it('3.4d: permission denied -> startRest works, id NULL, nothing pending', async () => {
    notifier.granted = false;
    await work.startWorkout();
    await rest.startRest();
    const s = await state();
    expect(s?.rest_ends_at).toBe(clock.now() + REST * SEC);
    expect(s?.rest_notification_id).toBeNull();
    expect(await rest.remainingSeconds()).toBe(REST);
    await rest.stopRest();
    expect(await rest.remainingSeconds()).toBe(0);
  });

  it('a throwing schedule still starts the rest (N3)', async () => {
    await work.startWorkout();
    notifier.scheduleError = new Error('boom');
    await expect(rest.startRest()).resolves.toBeUndefined();
    const s = await state();
    expect(s?.rest_ends_at).toBe(clock.now() + REST * SEC);
    expect(s?.rest_notification_id).toBeNull();
  });
});

describe('T2 stopRest (3.3a, 3.4c)', () => {
  it('cancels the id, clears the state, remaining = 0', async () => {
    await work.startWorkout();
    await rest.startRest();
    const id = (await state())?.rest_notification_id;
    clock.advance(20 * SEC);
    await rest.stopRest();
    const s = await state();
    expect(notifier.cancelled).toContain(id);
    expect(s?.rest_ends_at).toBeNull();
    expect(s?.rest_notification_id).toBeNull();
    expect(await rest.remainingSeconds()).toBe(0);
  });

  it('is an activity when a rest was running; no-op otherwise', async () => {
    await work.startWorkout();
    await rest.stopRest();
    expect(notifier.pending('reminder')).toHaveLength(1);
    const n = notifier.scheduled.length;
    await rest.startRest();
    await rest.stopRest();
    expect(notifier.scheduled.length).toBe(n + 3); // rest + reminder (start) + reminder (stop)
    expect(notifier.pending('reminder')).toHaveLength(1);
  });

  it('without an active workout does nothing', async () => {
    await expect(rest.stopRest()).resolves.toBeUndefined();
  });
});

describe('remaining / T4 / T5 (3.4e)', () => {
  it('3.4e: 100 s after the start 80 s remain (never a counter)', async () => {
    await work.startWorkout();
    await rest.startRest();
    clock.advance(100 * SEC);
    expect(await rest.remainingSeconds()).toBe(80);
    clock.advance(79_500);
    expect(await rest.remainingSeconds()).toBe(1); // ceil
    // a fresh service instance (app restart) sees the same state
    const other = createRestService({ db, notifier, clock, restSeconds: REST });
    expect(await other.remainingSeconds()).toBe(1);
  });

  it('remaining is 0 without a workout or rest', async () => {
    expect(await rest.remainingSeconds()).toBe(0);
    await work.startWorkout();
    expect(await rest.remainingSeconds()).toBe(0);
  });

  it('3.4e T5: onForeground with an expired rest clears it silently', async () => {
    await work.startWorkout();
    await rest.startRest();
    const restId = (await state())?.rest_notification_id;
    clock.advance((REST + 10) * SEC);
    const scheduledBefore = notifier.scheduled.length;
    await rest.onForeground();
    const s = await state();
    expect(s?.rest_ends_at).toBeNull();
    expect(s?.rest_notification_id).toBeNull();
    expect(notifier.scheduled.length).toBe(scheduledBefore); // nothing new, no vibration hook here
    // D11 / 3.4b: the rest notification is not cancelled; it is (or was) still delivered
    expect(notifier.cancelled).not.toContain(restId);
  });

  it('T5: onForeground with a running rest keeps it', async () => {
    await work.startWorkout();
    await rest.startRest();
    const before = await state();
    clock.advance(100 * SEC);
    await rest.onForeground();
    const after = await state();
    expect(after?.rest_ends_at).toBe(before?.rest_ends_at);
    expect(after?.rest_notification_id).toBe(before?.rest_notification_id);
    expect(await rest.remainingSeconds()).toBe(80);
  });

  it('T4: onTickReachedZero clears an expired rest once; a running rest is kept', async () => {
    await work.startWorkout();
    await rest.startRest();
    clock.advance(100 * SEC);
    expect(await rest.onTickReachedZero()).toBe(false);
    expect((await state())?.rest_ends_at).not.toBeNull();
    clock.advance(80 * SEC);
    expect(await rest.onTickReachedZero()).toBe(true);
    expect((await state())?.rest_ends_at).toBeNull();
    expect(await rest.onTickReachedZero()).toBe(false);
  });

  it('3.4a T4: clearing at zero keeps the rest notification so the foreground banner shows', async () => {
    await work.startWorkout();
    await rest.startRest();
    const restId = (await state())?.rest_notification_id;
    expect(restId).toBeTruthy();
    clock.advance(REST * SEC);
    expect(await rest.onTickReachedZero()).toBe(true);
    expect((await state())?.rest_notification_id).toBeNull();
    expect(notifier.cancelled).not.toContain(restId);
    expect(notifier.pending('rest').map((n) => n.id)).toContain(restId);
  });

  it('3.3a T2: stopRest still cancels the rest notification', async () => {
    await work.startWorkout();
    await rest.startRest();
    const restId = (await state())?.rest_notification_id;
    clock.advance(30 * SEC);
    await rest.stopRest();
    expect(notifier.cancelled).toContain(restId);
    expect(notifier.pending('rest')).toHaveLength(0);
  });
});

describe('rest id races (N1, N2)', () => {
  it('onPickup racing a manual startRest -> one pending rest notification, running rest not overwritten', async () => {
    await work.startWorkout();
    const gate = deferred();
    let first = true;
    notifier.scheduleGate = async () => {
      // park only the first schedule (the pickup's), let the manual start through
      if (first) {
        first = false;
        await gate.promise;
      }
    };
    const pickup = rest.onPickup();
    await tick();
    clock.advance(2 * SEC);
    await rest.startRest(); // wins the race
    const winner = await state();
    gate.resolve();
    await pickup;
    const s = await state();
    expect(s?.rest_ends_at).toBe(winner?.rest_ends_at);
    expect(s?.rest_notification_id).toBe(winner?.rest_notification_id);
    expect(notifier.pending('rest')).toHaveLength(1);
    expect(notifier.pending('rest')[0].id).toBe(s?.rest_notification_id);
  });

  it('same race with permission denied (ids NULL) does not overwrite the running rest', async () => {
    notifier.granted = false;
    await work.startWorkout();
    const gate = deferred();
    let first = true;
    notifier.scheduleGate = async () => {
      if (first) {
        first = false;
        await gate.promise;
      }
    };
    const pickup = rest.onPickup();
    await tick();
    clock.advance(2 * SEC);
    await rest.startRest();
    const winner = await state();
    gate.resolve();
    await pickup;
    expect((await state())?.rest_ends_at).toBe(winner?.rest_ends_at);
  });

  it('two concurrent startRest calls -> exactly one pending rest notification, the stored one', async () => {
    await work.startWorkout();
    const gate = deferred();
    notifier.scheduleGate = (kind) => (kind === 'rest' ? gate.promise : Promise.resolve());
    const both = Promise.all([rest.startRest(), rest.startRest()]);
    await tick();
    gate.resolve();
    await both;
    notifier.scheduleGate = null;
    const s = await state();
    expect(notifier.pending('rest')).toHaveLength(1);
    expect(s?.rest_notification_id).toBe(notifier.pending('rest')[0].id);
  });

  it('startRest overlapping finishWorkout -> no pending rest notification, NULL ids', async () => {
    await work.startWorkout();
    await work.addSet(BENCH, '80', '8');
    const gate = deferred();
    notifier.scheduleGate = (kind) => (kind === 'rest' ? gate.promise : Promise.resolve());
    const start = rest.startRest();
    await tick();
    await work.finishWorkout();
    gate.resolve();
    await start;
    notifier.scheduleGate = null;
    const s = await state();
    expect(s?.finished_at).not.toBeNull();
    expect(s?.rest_ends_at).toBeNull();
    expect(s?.rest_notification_id).toBeNull();
    expect(notifier.pending()).toHaveLength(0);
  });

  it('stopRest: a startRest that wins between cancel-before and the transaction is cancelled after commit (N2)', async () => {
    await work.startWorkout();
    await rest.startRest();
    const origCancel = notifier.cancel.bind(notifier);
    let injected = false;
    notifier.cancel = async (id) => {
      await origCancel(id);
      if (!injected) {
        injected = true;
        clock.advance(SEC);
        await rest.startRest(); // replaces the id after stop cancelled the old one
      }
    };
    await rest.stopRest();
    expect(injected).toBe(true);
    expect(notifier.pending('rest')).toHaveLength(0);
    const s = await state();
    expect(s?.rest_ends_at).toBeNull();
    expect(s?.rest_notification_id).toBeNull();
  });
});
