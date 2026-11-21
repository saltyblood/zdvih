import type { Db } from '../db/db';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings_glutes',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: number;
  name: string;
  muscle_group: MuscleGroup;
  is_builtin: boolean;
}

interface Row {
  id: number;
  name: string;
  muscle_group: MuscleGroup;
  is_builtin: number;
}

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  name: r.name,
  muscle_group: r.muscle_group,
  is_builtin: r.is_builtin === 1,
});

export function createExerciseRepo(db: Db) {
  return {
    async listAll(): Promise<Exercise[]> {
      const rows = await db.all<Row>(
        'SELECT id, name, muscle_group, is_builtin FROM exercises ORDER BY id',
      );
      return rows.map(toExercise);
    },
    async findById(id: number): Promise<Exercise | null> {
      const r = await db.first<Row>(
        'SELECT id, name, muscle_group, is_builtin FROM exercises WHERE id = ?',
        [id],
      );
      return r ? toExercise(r) : null;
    },
    async existsByKey(key: string): Promise<boolean> {
      const r = await db.first<{ id: number }>('SELECT id FROM exercises WHERE name_key = ?', [key]);
      return r !== null;
    },
    async insert(name: string, key: string, group: MuscleGroup, now: number): Promise<number> {
      const r = await db.run(
        'INSERT INTO exercises (name, name_key, muscle_group, is_builtin, created_at) VALUES (?, ?, ?, 0, ?)',
        [name, key, group, now],
      );
      return r.lastInsertRowId;
    },
    async hasSets(id: number): Promise<boolean> {
      const r = await db.first<{ n: number }>(
        'SELECT 1 AS n FROM sets WHERE exercise_id = ? LIMIT 1',
        [id],
      );
      return r !== null;
    },
    async remove(id: number): Promise<void> {
      await db.run('DELETE FROM exercises WHERE id = ?', [id]);
    },
  };
}
