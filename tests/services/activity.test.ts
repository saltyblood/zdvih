import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { REMINDER_SECONDS } from '../../src/config';
import { touch } from '../../src/services/activity';
import { createWorkoutService } from '../../src/services/workoutService';
import { createSqlJsDb } from '../support/sqljsDb';
import { FakeClock, FakeNotifier, deferred } from '../support/fakes';

const BENCH = 1;

let db: Db;
let notifier: FakeNotifier;
let clock: FakeClock;
let svc: ReturnType<typeof createWorkoutService>;

const doTouch = () => touch({ db, notifier, clock, reminderSeconds: REMINDER_SECONDS });
const row = () =>
  db.first<{
    finished_at: number | null;
    last_activity_at: number;
    reminder_notification_id: string | null;
    rest_notification_id: string | null;
  }>('SELECT * FROM workouts');
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
  notifier = new FakeNotifier();
  clock = new FakeClock();
  svc = createWorkoutService({ db, notifier, clock });
});

describe('N1-N3 notification id consistency (4.5a)', () => {
  it('touch with no active workout does nothing', async () => {
    await doTouch();
    expect(notifier.scheduled).toHaveLength(0);
  });

  it('two concurrent touches -> exactly one pending reminder and it is the stored one', async () => {
    await svc.startWorkout();
    const gate = deferred();
    notifier.scheduleGate = () => gate.promise; // both touches read, then both schedule
    clock.advance(1000);
    const both = Promise.all([doTouch(), doTouch()]);
    await tick();
    gate.resolve();
    await both;
    notifier.scheduleGate = null;
    const pending = notifier.pending('reminder');
    expect(pending).toHaveLength(1);
    expect((await row())?.reminder_notification_id).toBe(pending[0].id);
  });

  it('touch overlapping finishWorkout -> no pending reminder, NULL ids on the finished row', async () => {
    await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    const gate = deferred();
    notifier.scheduleGate = () => gate.promise;
    const t = doTouch(); // read the active workout, parked in schedule()
    await tick();
    notifier.scheduleGate = null;
    await svc.finishWorkout();
    gate.resolve();
    await t;
    expect(notifier.pending()).toHaveLength(0);
    const r = await row();
    expect(r?.finished_at).not.toBeNull();
    expect(r?.reminder_notification_id).toBeNull();
    expect(r?.rest_notification_id).toBeNull();
  });

  it('touch overlapping the discard of an empty workout -> no pending reminder', async () => {
    await svc.startWorkout();
    const gate = deferred();
    notifier.scheduleGate = () => gate.promise;
    const t = doTouch();
    await tick();
    notifier.scheduleGate = null;
    await svc.finishWorkout();
    gate.resolve();
    await t;
    expect(notifier.pending()).toHaveLength(0);
    expect(await row()).toBeNull();
  });

  it('an id stored by a touch that wins right after the cancel-before is cancelled after commit (N2)', async () => {
    await svc.startWorkout();
    await svc.addSet(BENCH, '80', '8');
    // finish cancels the stored id first; a touch completes right after that cancel
    const origCancel = notifier.cancel.bind(notifier);
    let injected = false;
    notifier.cancel = async (id) => {
      await origCancel(id);
      if (!injected) {
        injected = true;
        await doTouch();
      }
    };
    await svc.finishWorkout();
    expect(injected).toBe(true);
    expect(notifier.pending()).toHaveLength(0);
    expect((await row())?.reminder_notification_id).toBeNull();
  });

  it('schedule throwing -> addSet resolves, the set exists, the old id stays stored (N3)', async () => {
    await svc.startWorkout();
    const stored = (await row())?.reminder_notification_id;
    expect(stored).toBeTruthy();
    clock.advance(5000);
    notifier.scheduleError = new Error('boom');
    const s = await svc.addSet(BENCH, '80', '8');
    expect(s.reps).toBe(8);
    const active = await svc.getActive();
    expect(active?.sets).toHaveLength(1);
    expect(active?.reminder_notification_id).toBe(stored);
    expect(active?.last_activity_at).toBe(clock.now());
  });

  it('cancel throwing is ignored (N3)', async () => {
    await svc.startWorkout();
    notifier.cancelError = new Error('boom');
    await svc.addSet(BENCH, '80', '8');
    await expect(svc.finishWorkout()).resolves.toMatchObject({ discarded: false });
    expect((await row())?.finished_at).not.toBeNull();
  });

  it('double startWorkout via Promise.all -> one workout, one WORKOUT_ALREADY_ACTIVE (W1)', async () => {
    const results = await Promise.allSettled([svc.startWorkout(), svc.startWorkout()]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'WORKOUT_ALREADY_ACTIVE',
    });
    const c = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workouts');
    expect(c?.n).toBe(1);
    expect(notifier.pending('reminder')).toHaveLength(1);
  });

  it('a unique-index violation on insert is mapped to WORKOUT_ALREADY_ACTIVE (W1)', async () => {
    await db.run('INSERT INTO workouts (started_at, last_activity_at) VALUES (1, 1)');
    // hide the existing row from the in-transaction check so the index itself rejects the insert
    const blind: Db = {
      ...db,
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({
            ...tx,
            first: (sql, params) =>
              sql.includes('finished_at IS NULL')
                ? Promise.resolve(null)
                : tx.first(sql, params),
          }),
        ),
    };
    const s = createWorkoutService({ db: blind, notifier, clock });
    await expect(s.startWorkout()).rejects.toMatchObject({ code: 'WORKOUT_ALREADY_ACTIVE' });
  });
});
