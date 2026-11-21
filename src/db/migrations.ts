import type { Db } from './db';

type Migration = (db: Db) => Promise<void>;

const BUILTIN_EXERCISES: readonly (readonly [string, string])[] = [
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
];

const SCHEMA_1 = `
CREATE TABLE exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  name_key      TEXT    NOT NULL UNIQUE,
  muscle_group  TEXT    NOT NULL CHECK (muscle_group IN
                  ('chest','back','shoulders','biceps','triceps','quads','hamstrings_glutes')),
  is_builtin    INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  created_at    INTEGER NOT NULL
);

CREATE TABLE workouts (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at                INTEGER NOT NULL,
  finished_at               INTEGER NULL,
  last_activity_at          INTEGER NOT NULL,
  rest_ends_at              INTEGER NULL,
  rest_notification_id      TEXT    NULL,
  reminder_notification_id  TEXT    NULL
);
CREATE UNIQUE INDEX ux_workouts_one_active
  ON workouts ((finished_at IS NULL)) WHERE finished_at IS NULL;
CREATE INDEX ix_workouts_started ON workouts (started_at);

CREATE TABLE sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id   INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  weight_cg    INTEGER NOT NULL CHECK (weight_cg > 0 AND weight_cg <= 50000),
  reps         INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 100),
  position     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX ix_sets_workout  ON sets (workout_id, position);
CREATE INDEX ix_sets_exercise ON sets (exercise_id, workout_id);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`;

const migration1: Migration = async (db) => {
  await db.exec(SCHEMA_1);
  const now = Date.now();
  for (const [group, name] of BUILTIN_EXERCISES) {
    await db.run(
      'INSERT INTO exercises (name, name_key, muscle_group, is_builtin, created_at) VALUES (?, lower(trim(?)), ?, 1, ?)',
      [name, name, group, now],
    );
  }
};

/** Index + 1 = schema version. Append only. */
export const MIGRATIONS: Migration[] = [migration1];

/** Applies pending migrations in order; each runs in a transaction together with its version bump. */
export async function runMigrations(db: Db): Promise<void> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async (tx) => {
      await MIGRATIONS[v](tx);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
