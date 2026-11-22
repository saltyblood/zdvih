import { REMINDER_SECONDS } from '../config';
import { AppError } from '../domain/errors';
import type { Db } from '../db/db';
import { createWorkoutRepo } from '../repos/workoutRepo';
import { strings } from '../strings';
import { safeCancel, touch } from './activity';
import type { Clock, Notifier } from './ports';

export function createRestService({
  db,
  notifier,
  clock,
  restSeconds,
}: {
  db: Db;
  notifier: Notifier;
  clock: Clock;
  restSeconds: number;
}) {
  const workouts = createWorkoutRepo(db);
  const restMs = restSeconds * 1000;

  const touchActivity = () => touch({ db, notifier, clock, reminderSeconds: REMINDER_SECONDS });

  /**
   * T1 with N1. `onlyIfIdle` is used by T3: the idle check and the write are made
   * atomic by the conditional UPDATE (it matches only the state that was read), so a
   * concurrent startRest can neither be overwritten nor leave two rest notifications.
   * Returns true when this call wrote the new rest state.
   */
  async function begin(onlyIfIdle: boolean): Promise<boolean> {
    // N1 (1)
    const w = await workouts.findActive();
    if (!w) {
      if (onlyIfIdle) return false;
      throw new AppError('NO_ACTIVE_WORKOUT');
    }
    const now = clock.now();
    if (onlyIfIdle && w.rest_ends_at !== null && w.rest_ends_at > now) return false;
    const prev = { endsAt: w.rest_ends_at, notificationId: w.rest_notification_id };

    // N1 (2): T6 - schedule yields null when permission is denied; a throwing
    // notifier is treated the same (N3), the rest state itself is still stored.
    let created: string | null = null;
    try {
      created = await notifier.schedule(
        'rest',
        restSeconds,
        strings.notifications.restTitle,
        strings.notifications.restBody,
      );
    } catch {
      created = null;
    }

    // N1 (3)
    const written = await workouts.replaceRest(
      w.id,
      { endsAt: now + restMs, notificationId: created },
      prev,
    );

    // N1 (4)
    if (!written) {
      if (created) await safeCancel(notifier, created);
      return false;
    }
    if (prev.notificationId) await safeCancel(notifier, prev.notificationId);
    return true;
  }

  /** T1 (3.2a, 3.4b, 3.4c, 3.4d): start or restart the rest. Activity. */
  async function startRest(): Promise<void> {
    if (await begin(false)) await touchActivity();
  }

  /**
   * Clear the rest state. Returns true when this call cleared a rest.
   * - T2 (`onlyExpired = false`): N2, the stored notification is cancelled.
   * - T4/T5 (`onlyExpired = true`): only when rest_ends_at <= now, and the stored
   *   notification is kept so it is still delivered (foreground banner, D11, 3.4a).
   *   The conditional clear inside the transaction leaves a concurrently restarted
   *   rest (rest_ends_at > now) untouched, so no stale notification can survive.
   */
  async function clear(onlyExpired: boolean): Promise<boolean> {
    const before = await workouts.findActive();
    if (!before || before.rest_ends_at === null) return false;
    if (onlyExpired && before.rest_ends_at > clock.now()) return false;

    // N2: cancel the stored id first (T2 only)
    const cancelledId = onlyExpired ? null : before.rest_notification_id;
    if (cancelledId) await safeCancel(notifier, cancelledId);

    // N2: re-read inside the transaction, then write
    const txId = await db.transaction(async (tx) => {
      const txWorkouts = createWorkoutRepo(tx);
      const cur = await txWorkouts.findActive();
      if (!cur || cur.rest_ends_at === null) return { cleared: false, id: null };
      if (onlyExpired && cur.rest_ends_at > clock.now()) return { cleared: false, id: null };
      await txWorkouts.clearRest(cur.id, cur.rest_ends_at);
      return { cleared: true, id: cur.rest_notification_id };
    });

    // N2: cancel an id a concurrent N1 stored in between (T2 only)
    if (!onlyExpired && txId.id && txId.id !== cancelledId) await safeCancel(notifier, txId.id);
    return txId.cleared;
  }

  /** T2 (3.3a): stop the rest. Activity (only when a rest was actually running). */
  async function stopRest(): Promise<void> {
    if (await clear(false)) await touchActivity();
  }

  /** T3 (3.1a, 3.1b, 3.1e): automatic start on pickup. */
  async function onPickup(): Promise<void> {
    if (await begin(true)) await touchActivity();
  }

  /** D10 / 3.4e: remaining = rest_ends_at - now, never a counter. */
  async function remainingSeconds(): Promise<number> {
    const w = await workouts.findActive();
    if (!w || w.rest_ends_at === null) return 0;
    return Math.max(0, Math.ceil((w.rest_ends_at - clock.now()) / 1000));
  }

  /** T5: app returned to the foreground; an expired rest is cleared silently, notification kept. */
  async function onForeground(): Promise<void> {
    await clear(true);
  }

  /** T4: state clearing only (notification kept); the caller vibrates. Returns true if a rest was cleared. */
  async function onTickReachedZero(): Promise<boolean> {
    return clear(true);
  }

  return { startRest, stopRest, onPickup, remainingSeconds, onForeground, onTickReachedZero };
}

export type RestService = ReturnType<typeof createRestService>;
