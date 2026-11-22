import { REMINDER_SECONDS } from '../config';
import { AppError } from '../domain/errors';
import { bestSet, e1rmCg } from '../domain/oneRepMax';
import { parseWeight } from '../domain/weight';
import { parseReps } from '../domain/validation';
import { durationMinutes } from '../domain/time';
import type { Db } from '../db/db';
import { createExerciseRepo } from '../repos/exerciseRepo';
import { createSetRepo, type SetRow, type SetWithExerciseRow } from '../repos/setRepo';
import { createWorkoutRepo, type WorkoutRow } from '../repos/workoutRepo';
import { safeCancel, touch as touchActivity } from './activity';
import type { Clock, Notifier } from './ports';

export interface ActiveWorkout extends WorkoutRow {
  sets: SetWithExerciseRow[];
}

export interface PreviousSets {
  workoutStartedAt: number;
  sets: SetRow[];
}

export interface HistoryItem {
  id: number;
  startedAt: number;
  finishedAt: number;
  durationMinutes: number;
  setCount: number;
  volumeCg: number;
}

export interface ExerciseGroup {
  exerciseId: number;
  exerciseName: string;
  sets: SetWithExerciseRow[];
}

export interface WorkoutDetail extends HistoryItem {
  sets: SetWithExerciseRow[];
  /** sets grouped by exercise, in order of first appearance; sets in position order (5.2a) */
  groups: ExerciseGroup[];
}

export interface ProgressPoint {
  workoutId: number;
  startedAt: number;
  best: { weight_cg: number; reps: number };
  e1rmCg: number;
}

export interface FinishResult {
  workoutId: number;
  /** true when the workout had no sets and was deleted (1.2b) */
  discarded: boolean;
}

export function createWorkoutService({
  db,
  notifier,
  clock,
}: {
  db: Db;
  notifier: Notifier;
  clock: Clock;
}) {
  const workouts = createWorkoutRepo(db);
  const sets = createSetRepo(db);
  const exercises = createExerciseRepo(db);

  /** R1/R3: shared activity helper (after the activity's transaction committed). */
  const touch = () => touchActivity({ db, notifier, clock, reminderSeconds: REMINDER_SECONDS });

  async function requireActive(): Promise<WorkoutRow> {
    const w = await workouts.findActive();
    if (!w) throw new AppError('NO_ACTIVE_WORKOUT');
    return w;
  }

  async function getActive(): Promise<ActiveWorkout | null> {
    const w = await workouts.findActive();
    if (!w) return null;
    return { ...w, sets: await sets.listByWorkout(w.id) };
  }

  /** W1 */
  async function startWorkout(): Promise<WorkoutRow> {
    const now = clock.now();
    try {
      await db.transaction(async (tx) => {
        const txWorkouts = createWorkoutRepo(tx);
        if (await txWorkouts.findActive()) throw new AppError('WORKOUT_ALREADY_ACTIVE');
        await txWorkouts.insertActive(now);
      });
    } catch (e) {
      // concurrent start: ux_workouts_one_active rejected the insert
      // SQLite message: "UNIQUE constraint failed: index 'ux_workouts_one_active'"
      const msg = String((e as Error)?.message ?? '');
      if (
        !(e instanceof AppError) &&
        msg.includes('UNIQUE constraint failed') &&
        msg.includes('ux_workouts_one_active')
      ) {
        throw new AppError('WORKOUT_ALREADY_ACTIVE');
      }
      throw e;
    }
    await touch();
    return (await workouts.findActive()) as WorkoutRow;
  }

  /** W2 */
  async function finishWorkout(): Promise<FinishResult> {
    const w = await requireActive();
    // N2: cancel the stored ids first (N3: failures ignored)
    const cancelled = new Set<string>();
    for (const id of [w.rest_notification_id, w.reminder_notification_id]) {
      if (id) {
        cancelled.add(id);
        await safeCancel(notifier, id);
      }
    }
    const now = clock.now();
    // N2: re-read the ids inside the transaction, then write
    const { discarded, txIds } = await db.transaction(async (tx) => {
      const txSets = createSetRepo(tx);
      const txWorkouts = createWorkoutRepo(tx);
      const cur = await txWorkouts.findActive();
      if (!cur || cur.id !== w.id) throw new AppError('NO_ACTIVE_WORKOUT');
      const ids = [cur.rest_notification_id, cur.reminder_notification_id];
      if ((await txSets.countByWorkout(w.id)) === 0) {
        await txSets.removeByWorkout(w.id);
        await txWorkouts.remove(w.id);
        return { discarded: true, txIds: ids };
      }
      await txWorkouts.markFinished(w.id, now);
      return { discarded: false, txIds: ids };
    });
    // N2: cancel ids that a concurrent N1 stored in between
    for (const id of txIds) {
      if (id && !cancelled.has(id)) await safeCancel(notifier, id);
    }
    return { workoutId: w.id, discarded };
  }

  /** S3 */
  async function addSet(
    exerciseId: number,
    weightInput: string,
    repsInput: string,
  ): Promise<SetRow> {
    const w = await requireActive();
    const weight = parseWeight(weightInput);
    const reps = parseReps(repsInput);
    if (!(await exercises.findById(exerciseId))) throw new AppError('NOT_FOUND');
    const now = clock.now();
    const id = await db.transaction(async (tx) => {
      const txSets = createSetRepo(tx);
      const position = await txSets.nextPosition(w.id);
      return txSets.insert(w.id, exerciseId, weight, reps, position, now);
    });
    await touch();
    return (await sets.findById(id)) as SetRow;
  }

  /** S4 */
  async function updateSet(
    setId: number,
    weightInput: string,
    repsInput: string,
  ): Promise<SetRow> {
    const existing = await sets.findInActive(setId);
    if (!existing) throw new AppError('NOT_FOUND');
    const weight = parseWeight(weightInput);
    const reps = parseReps(repsInput);
    await db.transaction((tx) => createSetRepo(tx).update(setId, weight, reps));
    await touch();
    return (await sets.findById(setId)) as SetRow;
  }

  /** S4 */
  async function deleteSet(setId: number): Promise<void> {
    const existing = await sets.findInActive(setId);
    if (!existing) throw new AppError('NOT_FOUND');
    await db.transaction((tx) => createSetRepo(tx).remove(setId));
    await touch();
  }

  /** S5 */
  async function previousSets(exerciseId: number): Promise<PreviousSets | null> {
    const prev = await sets.previousForExercise(exerciseId);
    return prev ? { workoutStartedAt: prev.startedAt, sets: prev.sets } : null;
  }

  /** W4 */
  async function history(): Promise<HistoryItem[]> {
    const rows = await workouts.listFinishedSummaries();
    return rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationMinutes: durationMinutes(r.started_at, r.finished_at),
      setCount: r.set_count,
      volumeCg: r.volume_cg,
    }));
  }

  async function workoutDetail(id: number): Promise<WorkoutDetail> {
    const w = await workouts.findFinishedById(id);
    if (!w || w.finished_at === null) throw new AppError('NOT_FOUND');
    const all = await sets.listByWorkout(id);
    const groups: ExerciseGroup[] = [];
    for (const s of all) {
      let g = groups.find((x) => x.exerciseId === s.exercise_id);
      if (!g) {
        g = { exerciseId: s.exercise_id, exerciseName: s.exercise_name, sets: [] };
        groups.push(g);
      }
      g.sets.push(s);
    }
    return {
      id: w.id,
      startedAt: w.started_at,
      finishedAt: w.finished_at,
      durationMinutes: durationMinutes(w.started_at, w.finished_at),
      setCount: all.length,
      volumeCg: all.reduce((sum, s) => sum + s.weight_cg * s.reps, 0),
      sets: all,
      groups,
    };
  }

  /** W3 */
  async function deleteWorkout(id: number): Promise<void> {
    if (!(await workouts.findFinishedById(id))) throw new AppError('NOT_FOUND');
    await db.transaction(async (tx) => {
      await createSetRepo(tx).removeByWorkout(id);
      await createWorkoutRepo(tx).remove(id);
    });
  }

  /** 5.3a: best set per finished workout, ordered by started_at ASC. */
  async function progress(exerciseId: number): Promise<ProgressPoint[]> {
    const rows = await sets.listFinishedForExercise(exerciseId);
    const byWorkout = new Map<number, typeof rows>();
    for (const r of rows) {
      const list = byWorkout.get(r.workout_id);
      if (list) list.push(r);
      else byWorkout.set(r.workout_id, [r]);
    }
    return [...byWorkout.values()].map((list) => {
      const best = bestSet(list);
      return {
        workoutId: best.workout_id,
        startedAt: best.started_at,
        best: { weight_cg: best.weight_cg, reps: best.reps },
        e1rmCg: e1rmCg(best.weight_cg, best.reps),
      };
    });
  }

  return {
    getActive,
    startWorkout,
    finishWorkout,
    addSet,
    updateSet,
    deleteSet,
    previousSets,
    history,
    workoutDetail,
    deleteWorkout,
    progress,
  };
}

export type WorkoutService = ReturnType<typeof createWorkoutService>;
