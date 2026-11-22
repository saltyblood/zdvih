import type { Db } from '../db/db';

export interface WorkoutRow {
  id: number;
  started_at: number;
  finished_at: number | null;
  last_activity_at: number;
  rest_ends_at: number | null;
  rest_notification_id: string | null;
  reminder_notification_id: string | null;
}

export interface WorkoutSummaryRow {
  id: number;
  started_at: number;
  finished_at: number;
  set_count: number;
  volume_cg: number;
}

const COLS =
  'id, started_at, finished_at, last_activity_at, rest_ends_at, rest_notification_id, reminder_notification_id';

export function createWorkoutRepo(db: Db) {
  return {
    findActive(): Promise<WorkoutRow | null> {
      return db.first<WorkoutRow>(`SELECT ${COLS} FROM workouts WHERE finished_at IS NULL`);
    },
    findFinishedById(id: number): Promise<WorkoutRow | null> {
      return db.first<WorkoutRow>(
        `SELECT ${COLS} FROM workouts WHERE id = ? AND finished_at IS NOT NULL`,
        [id],
      );
    },
    async insertActive(now: number): Promise<number> {
      const r = await db.run('INSERT INTO workouts (started_at, last_activity_at) VALUES (?, ?)', [
        now,
        now,
      ]);
      return r.lastInsertRowId;
    },
    async setActivity(id: number, now: number, reminderId: string | null): Promise<void> {
      await db.run(
        'UPDATE workouts SET last_activity_at = ?, reminder_notification_id = ? WHERE id = ?',
        [now, reminderId, id],
      );
    },
    async markFinished(id: number, now: number): Promise<void> {
      await db.run(
        `UPDATE workouts SET finished_at = ?, rest_ends_at = NULL,
           rest_notification_id = NULL, reminder_notification_id = NULL WHERE id = ?`,
        [now, id],
      );
    },
    async remove(id: number): Promise<void> {
      await db.run('DELETE FROM workouts WHERE id = ?', [id]);
    },
    /** W4: finished workouts, newest first. */
    listFinishedSummaries(): Promise<WorkoutSummaryRow[]> {
      return db.all<WorkoutSummaryRow>(
        `SELECT w.id AS id, w.started_at AS started_at, w.finished_at AS finished_at,
                COUNT(s.id) AS set_count,
                COALESCE(SUM(s.weight_cg * s.reps), 0) AS volume_cg
           FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
          WHERE w.finished_at IS NOT NULL
          GROUP BY w.id
          ORDER BY w.started_at DESC, w.id DESC`,
      );
    },
  };
}
