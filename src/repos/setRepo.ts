import type { Db } from '../db/db';

export interface SetRow {
  id: number;
  workout_id: number;
  exercise_id: number;
  weight_cg: number;
  reps: number;
  position: number;
  created_at: number;
}

export interface SetWithExerciseRow extends SetRow {
  exercise_name: string;
}

export interface ProgressSetRow extends SetRow {
  started_at: number;
}

const COLS = 'id, workout_id, exercise_id, weight_cg, reps, position, created_at';
const SCOLS =
  's.id AS id, s.workout_id AS workout_id, s.exercise_id AS exercise_id, s.weight_cg AS weight_cg, s.reps AS reps, s.position AS position, s.created_at AS created_at';

export function createSetRepo(db: Db) {
  return {
    async countByWorkout(workoutId: number): Promise<number> {
      const r = await db.first<{ n: number }>(
        'SELECT COUNT(*) AS n FROM sets WHERE workout_id = ?',
        [workoutId],
      );
      return r?.n ?? 0;
    },
    async nextPosition(workoutId: number): Promise<number> {
      const r = await db.first<{ m: number | null }>(
        'SELECT MAX(position) AS m FROM sets WHERE workout_id = ?',
        [workoutId],
      );
      return (r?.m ?? 0) + 1;
    },
    async insert(
      workoutId: number,
      exerciseId: number,
      weightCg: number,
      reps: number,
      position: number,
      now: number,
    ): Promise<number> {
      const r = await db.run(
        `INSERT INTO sets (workout_id, exercise_id, weight_cg, reps, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [workoutId, exerciseId, weightCg, reps, position, now],
      );
      return r.lastInsertRowId;
    },
    findById(id: number): Promise<SetRow | null> {
      return db.first<SetRow>(`SELECT ${COLS} FROM sets WHERE id = ?`, [id]);
    },
    /** A set that belongs to the active workout (S4), or null. */
    findInActive(id: number): Promise<SetRow | null> {
      return db.first<SetRow>(
        `SELECT ${SCOLS}
           FROM sets s JOIN workouts w ON w.id = s.workout_id
          WHERE s.id = ? AND w.finished_at IS NULL`,
        [id],
      );
    },
    async update(id: number, weightCg: number, reps: number): Promise<void> {
      await db.run('UPDATE sets SET weight_cg = ?, reps = ? WHERE id = ?', [weightCg, reps, id]);
    },
    async remove(id: number): Promise<void> {
      await db.run('DELETE FROM sets WHERE id = ?', [id]);
    },
    /** D17: explicit delete, no reliance on cascades. */
    async removeByWorkout(workoutId: number): Promise<void> {
      await db.run('DELETE FROM sets WHERE workout_id = ?', [workoutId]);
    },
    listByWorkout(workoutId: number): Promise<SetWithExerciseRow[]> {
      return db.all<SetWithExerciseRow>(
        `SELECT ${SCOLS}, e.name AS exercise_name
           FROM sets s JOIN exercises e ON e.id = s.exercise_id
          WHERE s.workout_id = ?
          ORDER BY s.position`,
        [workoutId],
      );
    },
    /** S5: previous workout = finished workout with max started_at having the exercise. */
    async previousForExercise(
      exerciseId: number,
    ): Promise<{ startedAt: number; sets: SetRow[] } | null> {
      const w = await db.first<{ id: number; started_at: number }>(
        `SELECT w.id AS id, w.started_at AS started_at
           FROM workouts w
          WHERE w.finished_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_id = w.id AND s.exercise_id = ?)
          ORDER BY w.started_at DESC, w.id DESC LIMIT 1`,
        [exerciseId],
      );
      if (!w) return null;
      const sets = await db.all<SetRow>(
        `SELECT ${COLS} FROM sets WHERE workout_id = ? AND exercise_id = ? ORDER BY position`,
        [w.id, exerciseId],
      );
      return { startedAt: w.started_at, sets };
    },
    /** All sets of an exercise in finished workouts, oldest workout first. */
    listFinishedForExercise(exerciseId: number): Promise<ProgressSetRow[]> {
      return db.all<ProgressSetRow>(
        `SELECT ${SCOLS}, w.started_at AS started_at
           FROM sets s JOIN workouts w ON w.id = s.workout_id
          WHERE s.exercise_id = ? AND w.finished_at IS NOT NULL
          ORDER BY w.started_at ASC, w.id ASC, s.position ASC`,
        [exerciseId],
      );
    },
  };
}
