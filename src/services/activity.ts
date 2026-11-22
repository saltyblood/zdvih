import type { Db } from '../db/db';
import { createWorkoutRepo } from '../repos/workoutRepo';
import { strings } from '../strings';
import type { Clock, Notifier } from './ports';

export interface ActivityDeps {
  db: Db;
  notifier: Notifier;
  clock: Clock;
  reminderSeconds: number;
}

/**
 * R1/R3: record activity on the active workout (if any). Follows N1 (conditional
 * replace of the stored reminder id) and N3 (notifier failures never propagate).
 * Must be called after the activity's transaction committed, never inside
 * `transaction(fn)` (D16).
 */
export async function touch({ db, notifier, clock, reminderSeconds }: ActivityDeps): Promise<void> {
  const workouts = createWorkoutRepo(db);
  const now = clock.now();
  // N1 (1): read the active workout and the stored id
  const w = await workouts.findActive();
  if (!w) return;
  const old = w.reminder_notification_id;

  // N1 (2): schedule the new notification
  let created: string | null = null;
  try {
    created = await notifier.schedule(
      'reminder',
      reminderSeconds,
      strings.notifications.reminderTitle,
      strings.notifications.reminderBody,
    );
  } catch {
    // N3: failed schedule - keep the old id stored, still record the activity time
    await workouts.setLastActivity(w.id, now);
    return;
  }

  // N1 (3): conditional write
  const written = await workouts.replaceReminder(w.id, now, created, old);

  // N1 (4)
  if (!written) {
    if (created) await safeCancel(notifier, created);
    return;
  }
  if (old) await safeCancel(notifier, old);
}

/** N3: a failed cancel is ignored. */
export async function safeCancel(notifier: Notifier, id: string): Promise<void> {
  try {
    await notifier.cancel(id);
  } catch {
    // ignored (N3)
  }
}
