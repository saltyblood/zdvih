import { AppError } from '../domain/errors';
import { normalizeExerciseName } from '../domain/validation';
import type { Db } from '../db/db';
import {
  createExerciseRepo,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from '../repos/exerciseRepo';

export function createExerciseService({ db }: { db: Db }) {
  const repo = createExerciseRepo(db);

  /** E1: groups in schema order, built-ins first (seed order), then custom by name. */
  async function list(): Promise<Exercise[]> {
    const all = await repo.listAll();
    const groupIdx = (e: Exercise) => MUSCLE_GROUPS.indexOf(e.muscle_group);
    return all.sort((a, b) => {
      if (groupIdx(a) !== groupIdx(b)) return groupIdx(a) - groupIdx(b);
      if (a.is_builtin !== b.is_builtin) return a.is_builtin ? -1 : 1;
      if (a.is_builtin) return a.id - b.id;
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : a.id - b.id;
    });
  }

  /** E2 */
  async function create(name: string, group: MuscleGroup): Promise<Exercise> {
    const n = normalizeExerciseName(name);
    if (!MUSCLE_GROUPS.includes(group)) throw new AppError('NAME_INVALID');
    if (await repo.existsByKey(n.key)) throw new AppError('EXERCISE_EXISTS');
    const id = await repo.insert(n.name, n.key, group, Date.now());
    return { id, name: n.name, muscle_group: group, is_builtin: false };
  }

  async function canDelete(id: number): Promise<boolean> {
    const ex = await repo.findById(id);
    if (!ex || ex.is_builtin) return false;
    return !(await repo.hasSets(id));
  }

  /** E3 */
  async function remove(id: number): Promise<void> {
    const ex = await repo.findById(id);
    if (!ex) throw new AppError('NOT_FOUND');
    if (ex.is_builtin) throw new AppError('EXERCISE_BUILTIN');
    if (await repo.hasSets(id)) throw new AppError('EXERCISE_IN_USE');
    await repo.remove(id);
  }

  return { list, create, canDelete, delete: remove };
}

export type ExerciseService = ReturnType<typeof createExerciseService>;
