# Zdvih — Design Document

> **Purpose of this document:** implementation spec for an LLM/developer. It fixes every open technical decision left by `SPEC.md`, defines the data model, module interfaces, business rules and UI, and maps each acceptance criterion to a verifiable behaviour. Where this document says MUST, it is a requirement; where it says SHOULD, deviate only with a stated reason. Acceptance criteria are referenced by their `SPEC.md` numbers (e.g. 2.1b).

---

## 0. One-paragraph summary

Zdvih is an offline, single-user React Native (Expo SDK 58) app for logging gym workouts. The user starts a **workout**, logs **sets** (exercise + weight + reps) while seeing the sets of the **previous workout** for that exercise, and finishes the workout. A 180-second **rest** countdown starts automatically when the phone is **picked up** after lying still for at least 10 seconds (accelerometer), or manually by a button; when it ends the phone vibrates (app open) or a local notification fires (background / locked). While a workout is active the screen is kept on, and a reminder notification fires after 30 minutes of inactivity. History lists finished workouts; a progress screen charts the **estimated 1RM** (Epley) of the best set per workout. All data lives in a local SQLite database.

## 1. Goal and scope

- **Goal:** implement every function and acceptance criterion of `SPEC.md` v1.
- **In scope:** the Expo app in the repository root, its local database, notifications, accelerometer logic, unit/service tests.
- **Out of scope:** everything in `SPEC.md` §8. No network calls of any kind (G.a). No backend.

## 2. Decisions fixed by this document

| # | Open point | Decision |
|---|---|---|
| D1 | Project layout | Single Expo app at the **repository root** (no `frontend/`/`backend/` split — there is no backend). Expo Router (file-based routes in `app/`). TypeScript `strict: true`. |
| D2 | SDK pinning | Expo **SDK 58**, the version supported by Expo Go in the App Store (iOS Expo Go runs only the latest SDK; the project moved from SDK 54 to 58 in November 2026 for this reason). Every native-related package MUST be added with `npx expo install <pkg>` so its version matches SDK 58. Never run `npm install` for an `expo-*` or `react-native-*` package. |
| D3 | Testability boundary | Code in `src/domain`, `src/db/` (except `expoDb.ts`), `src/repos`, `src/services` MUST NOT import `react-native`, `expo-*` or React. Platform APIs reach them only through the interfaces in §5.2 (`Db`, `Notifier`, `Clock`). This lets all logic be tested in Node. |
| D4 | Test runner | **Vitest** (Node environment) for domain, repositories and services. Repositories are tested against **sql.js** (SQLite compiled to WebAssembly, no native build — works on Windows) through a test adapter implementing `Db`. No component/UI tests in v1; UI criteria are verified manually (§9). |
| D5 | Money-like units | Weight stored as **integer centi-kilograms** (`weight_cg`, 102.5 kg → `10250`). Never floats in the database. Conversion only in `src/domain/weight.ts`. |
| D6 | Time | All timestamps stored as **epoch milliseconds** (`INTEGER`). Formatting to the phone's local time happens only in `src/domain/time.ts` using the JS `Date` local-time getters. No date library. |
| D7 | Estimated 1RM | `e1rm(w, r) = r === 1 ? w : w * (1 + r / 30)`, computed in centi-kg as a float, displayed rounded to 0.1 kg with exactly one decimal (5.3c: 100×5 → `116.7 kg`, 80×1 → `80.0 kg`). |
| D8 | Vibration | `Vibration.vibrate()` from `react-native` (stronger than a single haptic tap; no extra dependency). `expo-haptics` from `project.md` is **not** used — deliberate deviation. |
| D9 | Chart | Own minimal `LineChart` component built on **`react-native-svg`** (included in Expo Go). No chart library: fewer dependencies and no native-module risk in Expo Go. |
| D10 | Rest and reminder state | Persisted on the active workout row (`rest_ends_at`, notification ids) so they survive the app being killed (1.3a, 3.4e). Remaining time is always `rest_ends_at − now`, never a counter. |
| D11 | Foreground notifications | `Notifications.setNotificationHandler`: notifications with `data.kind = 'rest'` are **not shown** in the foreground (the app vibrates itself); `data.kind = 'reminder'` is shown as a banner. |
| D12 | Where runtime logic lives | One root component `WorkoutRuntime` (mounted in `app/_layout.tsx`) owns keep-awake, the accelerometer subscription, the countdown tick and `AppState` handling, so they work on every screen while a workout is active. |
| D13 | Dev-only time overrides | In development builds (`__DEV__`) the env vars `EXPO_PUBLIC_REST_SECONDS` and `EXPO_PUBLIC_REMINDER_SECONDS` override 180 and 1800 so the timers can be tested by hand. Ignored when `__DEV__` is false. |
| D14 | Notification permission | Requested when the user starts their **first** workout, not at app launch. |
| D15 | State management | No state library. A React context `ActiveWorkoutContext` exposes the active workout and a `refresh()`; list screens reload from repositories in `useFocusEffect`. |
| D16 | Transactions on the phone | `expoDb.transaction` uses **`withTransactionAsync`**, not `withExclusiveTransactionAsync`: the exclusive variant opens a new connection on which `PRAGMA foreign_keys` is not set. Because `withTransactionAsync` is not exclusive, `expoDb.ts` MUST serialise all calls through one promise queue (mutex) so no other query interleaves with a running transaction. |
| D17 | No reliance on cascades | Deleting a workout deletes its sets with an explicit `DELETE FROM sets WHERE workout_id = ?` in the same transaction. `ON DELETE CASCADE` stays in the schema as a safety net only. |
| D18 | Device check screen | Step 1 adds a development-only screen `app/dev-check.tsx` (route hidden when `__DEV__` is false), reachable from a "Device check" link on the home screen that is rendered only when `__DEV__` is true, with: "Notify in 10 s" (local notification), "Vibrate", a keep-awake toggle, a live accelerometer read-out showing the per-sample delta, and "SQLite write/read". The human runs it on the iPhone in Expo Go right after step 1 to confirm every native capability before any feature is built; the delta read-out is later used to tune the detector thresholds (R3). |

## 3. Data model

### 3.1 ER overview

```
workouts 1──* sets *──1 exercises
```

### 3.2 Schema (SQLite)

Applied by `src/db/migrations.ts`; the schema version is kept in `PRAGMA user_version`. `PRAGMA foreign_keys = ON` MUST be executed on every connection open (both adapters).

```sql
-- migration 1
CREATE TABLE exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,                 -- trimmed, as entered
  name_key      TEXT    NOT NULL UNIQUE,          -- lower(trim(name)); enforces 4.2b
  muscle_group  TEXT    NOT NULL CHECK (muscle_group IN
                  ('chest','back','shoulders','biceps','triceps','quads','hamstrings_glutes')),
  is_builtin    INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
  created_at    INTEGER NOT NULL
);

CREATE TABLE workouts (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at                INTEGER NOT NULL,
  finished_at               INTEGER NULL,          -- NULL = active
  last_activity_at          INTEGER NOT NULL,
  rest_ends_at              INTEGER NULL,          -- NULL = no rest running
  rest_notification_id      TEXT    NULL,
  reminder_notification_id  TEXT    NULL
);
-- at most one active workout (1.1b): the expression is 1 for every active row
CREATE UNIQUE INDEX ux_workouts_one_active
  ON workouts ((finished_at IS NULL)) WHERE finished_at IS NULL;
CREATE INDEX ix_workouts_started ON workouts (started_at);

CREATE TABLE sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id   INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  weight_cg    INTEGER NOT NULL CHECK (weight_cg > 0 AND weight_cg <= 50000),
  reps         INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 100),
  position     INTEGER NOT NULL,                   -- logging order within the workout
  created_at   INTEGER NOT NULL
);
CREATE INDEX ix_sets_workout  ON sets (workout_id, position);
CREATE INDEX ix_sets_exercise ON sets (exercise_id, workout_id);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,                         -- e.g. 'notif_hint_shown'
  value  TEXT NOT NULL
);
```

Migration 1 also inserts the 14 built-in exercises (`is_builtin = 1`), in this order:

| muscle_group | name |
|---|---|
| chest | Barbell Bench Press; Incline Dumbbell Press |
| back | Lat Pulldown; Seated Cable Row |
| shoulders | Overhead Barbell Press; Dumbbell Lateral Raise |
| biceps | Barbell Curl; Dumbbell Hammer Curl |
| triceps | Cable Triceps Pushdown; Overhead Dumbbell Triceps Extension |
| quads | Barbell Back Squat; Leg Press |
| hamstrings_glutes | Romanian Deadlift; Lying Leg Curl |

Display names of muscle groups: Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings & Glutes.

### 3.3 Derived concepts (computed, not stored)

| Concept | Definition |
|---|---|
| Active workout | `workouts.finished_at IS NULL` (at most one row). |
| Finished workout | `finished_at IS NOT NULL`. Only finished workouts appear in history, "previous sets" and progress. |
| Duration (min) | `floor((finished_at − started_at) / 60000)`. |
| Volume | `Σ weight_cg × reps / 100` kg over the sets in question. |
| Set e1RM | D7. |
| Best set (workout, exercise) | Set with max e1RM; ties → earliest `position`. |
| Previous workout (exercise) | Finished workout with max `started_at` that has ≥ 1 set of the exercise. |
| Rest remaining (s) | `max(0, ceil((rest_ends_at − now) / 1000))`. |

## 4. Business rules (authoritative list)

### 4.1 Workouts
- **W1.** `startWorkout()` fails with `WORKOUT_ALREADY_ACTIVE` if an active workout exists (1.1b). Sets `started_at = last_activity_at = now`. Counts as activity (schedules the reminder, R1).
- **W2.** `finishWorkout()` cancels the rest notification and the reminder notification, then: if the workout has 0 sets → **delete the row** (1.2b); else set `finished_at = now`, `rest_ends_at = NULL`, notification ids = NULL (1.2a, 1.5d). Runs in one transaction (notifications cancelled before it).
- **W3.** `deleteWorkout(id)` only for finished workouts (`NOT_FOUND` otherwise); in one transaction deletes its sets explicitly, then the workout (D17) (5.4a). The same explicit delete is used by W2 for an empty workout. UI asks for confirmation.
- **W4.** History: finished workouts ordered `started_at DESC` with `set_count` and `volume_cg` (5.1a).

### 4.2 Sets
- **S1.** Weight input: trim, regex `^\d{1,3}([.,]\d{1,2})?$`, replace `,` by `.`, convert to centi-kg exactly (string arithmetic, not `parseFloat × 100`), require `1 ≤ weight_cg ≤ 50000` → else `WEIGHT_INVALID` (2.1b).
- **S2.** Reps input: regex `^\d{1,3}$`, integer `1..100` → else `REPS_INVALID` (2.1c).
- **S3.** `addSet(exerciseId, weightInput, repsInput)` requires an active workout (`NO_ACTIVE_WORKOUT`) and an existing exercise (`NOT_FOUND`); `position = max(position) + 1` within the workout. Activity. Does **not** touch the rest timer (3.1d).
- **S4.** `updateSet` / `deleteSet` only for sets of the active workout (`NOT_FOUND` otherwise), same validation (2.3a). Activity.
- **S5.** `previousSets(exerciseId)` → `{ workoutStartedAt, sets[] } | null` from the previous workout (§3.3), sets in `position` order (2.2a/2.2b). Prefill = last set of that list (2.2c).

### 4.3 Exercises
- **E1.** List: all exercises, grouped by muscle group in the order of §3.2, built-ins first then custom by name.
- **E2.** `createExercise(name, group)`: trim; length 1–60 → else `NAME_INVALID`; group in the 7 values; `name_key` collision → `EXERCISE_EXISTS` with message "Exercise already exists" (4.2a, 4.2b).
- **E3.** `deleteExercise(id)`: built-in → `EXERCISE_BUILTIN`; any set references it → `EXERCISE_IN_USE`; else delete (4.1b, 4.2c). `canDelete(id)` is used by the UI to hide the option.
- **E4.** No rename in v1 (built-ins cannot be renamed — 4.1b; custom rename is not a SPEC function).

### 4.4 Rest timer
- **T1.** `startRest(now)`: requires an active workout. If a rest is running, cancel its notification first (restart, 3.2a). Set `rest_ends_at = now + REST_MS`, schedule notification `{kind:'rest', title:'Rest is over', body:'Time for the next set.'}` after `REST_SECONDS`, store its id. Activity.
- **T2.** `stopRest()`: cancel notification, clear `rest_ends_at` and id (3.3a). Activity.
- **T3.** Automatic start: on a `pickup` event from the detector (§5.5), call `startRest` **only if** a workout is active and no rest is running (3.1a, 3.1b, 3.1e).
- **T4.** Countdown end while the app is active: when the tick observes remaining time crossing from > 0 to 0, call `Vibration.vibrate()` once and clear the rest state (keep the delivered/pending notification untouched — the foreground handler suppresses it, D11) (3.4a).
- **T5.** App returns to foreground with `rest_ends_at ≤ now`: clear the rest state **silently** (the notification was already shown, 3.4b). With `rest_ends_at > now`: the countdown simply continues from the stored end time (3.4e).
- **T6.** If notification permission is denied: T1/T2 still work; scheduling is skipped (id NULL); the active-workout screen shows a one-time hint "Rest alerts are off while the screen is locked. Enable notifications in Settings." The "already shown" flag is stored in the `settings` table, `key = 'notif_hint_shown'` (3.4d).

### 4.5 Inactivity reminder
- **R1.** Every activity (W1, S3, S4, T1, T2) calls `touch(now)`: set `last_activity_at = now`, cancel the pending reminder notification, schedule a new one after `REMINDER_SECONDS` (1800) `{kind:'reminder', title:'Your workout is still open', body:'Finish it or keep logging.'}`, store its id (1.5a, 1.5b).
- **R2.** The reminder never changes the workout (1.5c). W2 cancels it (1.5d).

### 4.6 Error codes
`WORKOUT_ALREADY_ACTIVE`, `NO_ACTIVE_WORKOUT`, `NOT_FOUND`, `WEIGHT_INVALID`, `REPS_INVALID`, `NAME_INVALID`, `EXERCISE_EXISTS`, `EXERCISE_BUILTIN`, `EXERCISE_IN_USE`. Thrown as `AppError(code)` from `src/domain/errors.ts`; mapped to English text in `src/strings.ts`.

## 5. Module design

### 5.1 Directory layout

```
app/                          # Expo Router routes (UI only)
  _layout.tsx                 # opens DB, runs migrations, providers, notification handler, <WorkoutRuntime/>
  index.tsx                   # Home
  workout.tsx                 # Active workout
  log-set.tsx                 # Log / edit a set (modal); ?setId= for edit
  exercises/index.tsx         # Exercise list
  exercises/new.tsx           # Add custom exercise
  exercises/[id].tsx          # Progress of one exercise
  history/index.tsx           # History list
  history/[id].tsx            # Workout detail
src/
  config.ts                   # REST_SECONDS, REMINDER_SECONDS, detector thresholds, D13 overrides
  strings.ts                  # all UI text + error code → message
  domain/                     # pure functions, no I/O
    errors.ts  weight.ts  oneRepMax.ts  volume.ts  time.ts  validation.ts  pickupDetector.ts
  db/
    db.ts                     # Db interface (§5.2)
    migrations.ts             # migration list + seed + runMigrations(db)
    expoDb.ts                 # Db adapter over expo-sqlite (the only file here importing expo)
  repos/
    exerciseRepo.ts  workoutRepo.ts  setRepo.ts
  services/
    ports.ts                  # Notifier, Clock interfaces
    workoutService.ts         # W1–W4, S3–S5, R1–R2
    restService.ts            # T1–T2, T5 decision logic
    exerciseService.ts        # E1–E3
  platform/                   # adapters that import expo / react-native
    expoNotifier.ts           # Notifier over expo-notifications + handler (D11) + permission
    systemClock.ts
  ui/
    ActiveWorkoutContext.tsx
    WorkoutRuntime.tsx        # keep-awake, accelerometer → detector, tick, AppState
    components/  LineChart.tsx RestBar.tsx SetRow.tsx Button.tsx ConfirmDialog.ts EmptyState.tsx
tests/
  support/sqljsDb.ts          # Db adapter over sql.js
  support/fakes.ts            # FakeNotifier, FakeClock
  domain/*.test.ts
  repos/*.test.ts
  services/*.test.ts
vitest.config.ts
CLAUDE.md
```

### 5.2 Interfaces

```ts
// src/db/db.ts
export interface Db {
  exec(sql: string): Promise<void>;                                   // multiple statements, no params
  run(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

// src/services/ports.ts
export type NotificationKind = 'rest' | 'reminder';
export interface Notifier {
  /** returns the scheduled id, or null when permission is denied */
  schedule(kind: NotificationKind, seconds: number, title: string, body: string): Promise<string | null>;
  cancel(id: string): Promise<void>;          // no-op for unknown/delivered ids
  permissionGranted(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
}
export interface Clock { now(): number }      // epoch ms
```

`expoDb.ts` maps to `openDatabaseAsync('zdvih.db')`, `execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync` (D16), and runs `PRAGMA foreign_keys = ON` right after opening, outside any transaction (the pragma has no effect inside one). `sqljsDb.ts` implements the same with `BEGIN/COMMIT/ROLLBACK`.

### 5.3 Domain functions (all unit-tested)

```ts
// weight.ts
parseWeight(input: string): number            // → weight_cg, throws AppError('WEIGHT_INVALID')
formatKg(cg: number): string                  // 10250 → "102.5 kg", 10000 → "100 kg", 10025 → "100.25 kg"
// oneRepMax.ts
e1rmCg(weightCg: number, reps: number): number
formatE1rm(cg: number): string                // always one decimal: "116.7 kg", "80.0 kg"
bestSet<T extends {weight_cg:number; reps:number; position:number}>(sets: T[]): T
// volume.ts
volumeCg(sets: {weight_cg:number; reps:number}[]): number
// validation.ts
parseReps(input: string): number
normalizeExerciseName(input: string): { name: string; key: string }   // throws NAME_INVALID
// time.ts
formatDate(ms): string        // "Fri, 20 Nov 2026"
formatTime(ms): string        // "14:30"
durationMinutes(startMs, endMs): number
formatCountdown(seconds): string   // 180 → "3:00", 5 → "0:05"
```

### 5.4 Services (all service-tested with sql.js + fakes)

`createWorkoutService({ db, notifier, clock })` exposes: `getActive()`, `startWorkout()`, `finishWorkout()`, `addSet(exerciseId, weightInput, repsInput)`, `updateSet(setId, weightInput, repsInput)`, `deleteSet(setId)`, `previousSets(exerciseId)`, `history()`, `workoutDetail(id)`, `deleteWorkout(id)`, `progress(exerciseId)` → `[{ workoutId, startedAt, best: {weight_cg, reps}, e1rmCg }]` ordered by `started_at ASC` (5.3a).

`createRestService({ db, notifier, clock, restSeconds })` exposes: `startRest()`, `stopRest()`, `onPickup()` (T3), `remainingSeconds()`, `onForeground()` (T5), `onTickReachedZero()` (T4 state clearing; vibration is done by the caller in the UI).

`createExerciseService({ db })` exposes: `list()`, `create(name, group)`, `canDelete(id)`, `delete(id)`.

### 5.5 Pickup detector (pure, `src/domain/pickupDetector.ts`)

```ts
export type Sample = { t: number; x: number; y: number; z: number };   // t in ms, values in g
export function createPickupDetector(cfg: {
  stillMaxDelta: number;   // default 0.03 g
  pickupMinDelta: number;  // default 0.12 g
  stillMs: number;         // 10000 (SPEC)
}): { push(s: Sample): 'pickup' | null; reset(): void };
```

Algorithm: `delta = |s − previous|` (Euclidean norm of the difference of consecutive samples).
- `delta ≤ stillMaxDelta` → if `stillSince` is null set it to `s.t`.
- `delta ≥ pickupMinDelta` → if `stillSince != null && s.t − stillSince ≥ stillMs` return `'pickup'`; in all cases set `stillSince = null`.
- otherwise (between thresholds) → `stillSince = null`.

`expo-sensors` reports `timestamp` in **seconds** and values in g; `WorkoutRuntime` converts the timestamp to milliseconds before calling `push`. `reset()` clears state; called when the app goes to background or no workout is active (the accelerometer listener receives nothing while the app is in the background). `WorkoutRuntime` subscribes with `Accelerometer.setUpdateInterval(100)` only while a workout is active and the app is in the foreground; if `Accelerometer.isAvailableAsync()` is false, automatic start is silently disabled (manual button still works). Thresholds live in `src/config.ts` and are expected to be tuned on a real iPhone (R-3).

## 6. UI design

### 6.1 Routes

| Path | Screen | Notes |
|---|---|---|
| `/` | Home | Active workout → card "Workout in progress · 23 min" + "Resume"; else big "Start workout". Links: History, Exercises. |
| `/workout` | Active workout | Redirects to `/` if no active workout. |
| `/log-set` | Log set (modal) | `?setId=` → edit mode. |
| `/exercises` | Exercise list | |
| `/exercises/new` | Add exercise | |
| `/exercises/[id]` | Progress | |
| `/history` | History | |
| `/history/[id]` | Workout detail | |

### 6.2 Key screen behaviours

**Home.** "Start workout" calls `startWorkout()`; on the first ever start it requests notification permission (D14), then navigates to `/workout` (1.1a). While a workout is active the button is replaced by the Resume card (1.1b).

**Active workout.** Header: start time and elapsed minutes. Body: sets grouped by exercise in logged order (`Barbell Bench Press — 80 kg × 8`), each row tappable → `/log-set?setId=…` (2.1d, 2.3a). Sticky bottom: `RestBar` and a primary "Log set" button. Top-right: "Finish" → confirm dialog "Finish workout?"; if the workout has 0 sets the dialog text is "No sets logged. Discard this workout?" (1.2a, 1.2b). Shows the T6 hint once when permission is denied (3.4d).

**RestBar.** Idle: button "Start rest". Running: large countdown `2:47`, buttons "Restart" (calls `startRest`) and "Stop" (3.2a, 3.3a). Re-renders every 250 ms from `remainingSeconds()` (3.4e).

**Log set.** Step 1 exercise picker grouped by muscle group (search field filters by name). Step 2: "Last time · Tue, 17 Nov 2026" with the previous sets, or "No previous sets" (2.2a, 2.2b); fields Weight (kg, decimal keyboard) and Reps (number pad) pre-filled per S5 (2.2c); "Save set" disabled until both parse (2.1a); inline field errors from S1/S2. Edit mode: exercise fixed, buttons "Save" and "Delete set" (confirm) (2.3a). Saving returns to `/workout`.

**Exercises.** Sections per muscle group; built-ins without delete; custom rows show "Delete" only when `canDelete` (4.1b, 4.2c). "Add exercise" → form name + group picker; `EXERCISE_EXISTS` shown under the name field (4.2a, 4.2b). Tapping a row → progress.

**Progress.** `LineChart` of `e1rmCg` per workout (x evenly spaced, first/last date labels, y-axis min/max labels in kg) and below it a list "date — best set 100 kg × 5 — e1RM 116.7 kg". Fewer than 2 points → the text from 5.3b instead of the chart.

**History.** Rows: `Fri, 20 Nov 2026 · 14:30 · 62 min · 18 sets · 8,450 kg` (thousands separator `,`) (5.1a). Detail: sets grouped by exercise (5.2a) and a "Delete workout" button with confirmation (5.4a).

### 6.3 WorkoutRuntime (root, D12)

While `active != null`: `useKeepAwake()` (1.4a — unmounting it restores auto-lock after finish); accelerometer → detector → `restService.onPickup()`; a 250 ms interval that detects the crossing to 0 (T4 → `Vibration.vibrate()`); `AppState` listener: `background` → `detector.reset()`, `active` → `restService.onForeground()` then `refresh()`.

## 7. Test strategy

- **Unit (Vitest):** every function in `src/domain`, including the pickup detector with synthetic sample sequences.
- **Repository/service (Vitest + sql.js + FakeNotifier + FakeClock):** each test creates a fresh in-memory database via `runMigrations`. FakeNotifier records `schedule`/`cancel` calls and can simulate denied permission. FakeClock is advanced manually.
- **Manual on device (Expo Go, iPhone):** UI criteria and anything needing real sensors, notifications or the lock screen; checklist in §9, run by the human after each UI step.
- Agents MUST NOT disable, skip or delete tests.

## 8. Acceptance criteria → verification matrix

| AC | How it is satisfied | Verification |
|---|---|---|
| 1.1a | W1, Home | Service: start → active with `started_at = clock.now()`. Manual: tap Start. |
| 1.1b | W1 + unique partial index | Service: second start → `WORKOUT_ALREADY_ACTIVE`; raw SQL insert of second active row → constraint error. |
| 1.2a | W2 | Service: start, add set, advance clock 62 min, finish → history row, duration 62. |
| 1.2b | W2 | Service: start, finish → no row in `workouts`. |
| 1.3a | State in DB | Service: new service instance on same DB returns same active workout + sets. Manual: kill app, reopen. |
| 1.4a | `useKeepAwake` in WorkoutRuntime | Manual: active workout, wait past auto-lock time → screen stays on; after finish → locks normally. |
| 1.5a | R1 | Service: start → FakeNotifier has `reminder` with 1800 s. Manual (D13 = 60 s): banner appears. |
| 1.5b | R1 | Service: start, add set → previous reminder id cancelled, exactly one pending reminder. |
| 1.5c | R2 | Service: after reminder time passes, workout still active, duration counts full time. |
| 1.5d | W2 | Service: finish → reminder id cancelled. |
| 2.1a | Log set form | Manual: Save disabled with empty fields. |
| 2.1b | S1 | Unit: accepts `0.5`, `102,5`, `500`, `12.25`; rejects `0`, `-1`, `500.01`, `1.234`, `abc`, `""`. Exact: `102,5` → 10250. |
| 2.1c | S2 | Unit: accepts `1`, `100`; rejects `0`, `101`, `2.5`, `x`. |
| 2.1d | S3 positions | Service: three sets → positions 1,2,3 in order. Manual: row appears. |
| 2.2a | S5 | Service: two finished workouts with the exercise → sets of the newer one + its date. |
| 2.2b | S5 | Service: unused exercise → `null`. |
| 2.2c | S5 prefill | Service: prefill equals last set of previous workout. Manual: fields pre-filled. |
| 2.3a | S4 | Service: update with `1.234` → `WEIGHT_INVALID`; delete → gone; editing a set of a finished workout → `NOT_FOUND`. |
| 3.1a | Detector + T3 | Unit: 10 s of still samples then a large delta → `'pickup'`. Service: `onPickup` with active workout → rest running 180 s. Manual on iPhone. |
| 3.1b | T3 | Service: rest running, `onPickup` → `rest_ends_at` unchanged, no new schedule. |
| 3.1c | Detector | Unit: 9.9 s still then large delta → `null`; continuous medium deltas → `null`. |
| 3.1d | S3 | Service: addSet while rest running → `rest_ends_at` unchanged; while idle → still idle. |
| 3.1e | T3 | Service: no active workout, `onPickup` → nothing scheduled. |
| 3.2a | T1 | Service: start rest, advance 60 s, start rest → old id cancelled, `rest_ends_at = now + 180 s`. |
| 3.3a | T2 | Service: stop → id cancelled, `remainingSeconds() = 0`. |
| 3.4a | T4 | Manual: wait 180 s (or D13) with app open → vibration, no banner. |
| 3.4b | T1 schedule | Service: schedule called with `kind 'rest'`, 180 s. Manual: lock screen → notification "Rest is over". |
| 3.4c | T1/T2 cancel | Service: restart and stop both cancel the previous id. |
| 3.4d | T6 | Service: FakeNotifier denied → `startRest` works, id NULL. Manual: deny permission → hint shown once. |
| 3.4e | D10 | Service: start rest, advance clock 100 s → `remainingSeconds() = 80`; T5 with expired rest → cleared, no vibration call. |
| 4.1a | Migration seed | Repo: fresh DB → 14 exercises, 7 groups, names as §3.2. |
| 4.1b | E3, UI | Service: delete built-in → `EXERCISE_BUILTIN`. Manual: no delete option. |
| 4.2a | E2 | Unit/service: `""`, `"   "`, 61 chars → `NAME_INVALID`; 60 chars OK; trimmed on save. |
| 4.2b | E2 + unique `name_key` | Service: `" barbell curl "` → `EXERCISE_EXISTS`. |
| 4.2c | E3 | Service: custom with a set → `canDelete = false`, delete → `EXERCISE_IN_USE`; unused → deleted. |
| 5.1a | W4 | Service: three workouts → newest first, correct set count and volume. |
| 5.2a | `workoutDetail` | Service: sets grouped by exercise in position order. |
| 5.3a | `progress` | Service: 3 workouts → 3 points ASC, each the best set's e1RM. |
| 5.3b | UI rule | Manual: exercise with 1 workout shows the message. |
| 5.3c | D7 | Unit: `formatE1rm(e1rmCg(10000,5)) = "116.7 kg"`, `formatE1rm(e1rmCg(8000,1)) = "80.0 kg"`. |
| 5.4a | W3 cascade | Service: delete → no sets left; `previousSets` and `progress` no longer include it. |
| G.a | No network code | Review: `grep -rE "fetch\(|axios|XMLHttpRequest" src app` returns nothing. Manual: airplane mode run-through. |
| G.b | SQLite | Covered by 1.3a; manual reopen. |

## 9. Commands (authoritative — agents use exactly these)

| Purpose | Command (repo root) | Notes |
|---|---|---|
| Install deps | `npm ci` | |
| Add an Expo/RN package | `npx expo install <pkg>` | D2. Pure-JS dev tools (vitest, sql.js) via `npm install -D`. |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| Lint | `npm run lint` | `expo lint`. Step 1 MUST create `eslint.config.js` (flat config extending `eslint-config-expo`) and install `eslint` + `eslint-config-expo` explicitly, so later runs never prompt. |
| Tests | `npm test` | `vitest run` (Node, no watch) |
| Build check | `npm run build` | `expo export --platform ios --output-dir dist` — bundles JS with Metro; proves the app compiles. `dist/` is git-ignored. Step 1 MUST confirm this command succeeds on the Windows machine; if it does not, record the deviation and use `--platform android` instead (same JS, same check). |
| Run on phone (human) | `npx expo start` | Scan the QR code with the iPhone camera; opens in Expo Go. Not run by agents. |

Both agents in the pipeline MUST run `typecheck`, `lint`, `test` and `build` (whichever exist at that point of §11) before reporting.

## 10. Security & privacy checklist

- No network access, no analytics, no third-party SDKs that phone home (G.a).
- All SQL through parameterised `run/all/first` — no string interpolation of user input.
- No `eval`, no dynamic code loading.
- Data stays in the app sandbox; deleting the app deletes the data (documented, accepted).

## 11. Implementation order

Each numbered step is **one run of the pipeline**: `/implement zdvih-design.md <step>`. A run implements only its step, treats earlier steps as present, and MUST leave all commands of §9 green.

1. **Scaffold, device check & domain.** Create the Expo SDK 58 app at the repo root (TypeScript template, Expo Router), `strict` TS, scripts and ESLint config of §9, Vitest config, folder skeleton of §5.1, `src/config.ts`, `src/strings.ts`, `src/domain/*` except the detector. Install `expo-sqlite expo-sensors expo-notifications expo-keep-awake react-native-svg` with `npx expo install`. Add the dev-check screen (D18). Unit tests for weight, reps, names, e1RM, volume, time. **Human checkpoint:** open the dev-check screen on the iPhone and confirm all five capabilities before step 2.
2. **Database.** `Db` interface, `expoDb.ts`, `tests/support/sqljsDb.ts`, migrations + seed + settings table. Exercise repo/service (E1–E3). Tests 4.1a, 4.1b, 4.2a–c.
3. **Workout & set services.** `ports.ts`, fakes, workoutService (W1–W4, S3–S5, R1–R2, `progress`). Tests for 1.1–1.5 (service parts), 2.x, 5.1a, 5.2a, 5.3a, 5.4a.
4. **Rest service & detector.** `restService` (T1–T5), `pickupDetector`. Tests for 3.x (service and unit parts).
5. **App shell.** `expoNotifier.ts`, `systemClock.ts`, `_layout.tsx` (DB open, migrations, notification handler D11), `ActiveWorkoutContext`, Home, Active workout screen (sets list, Finish), `WorkoutRuntime` with keep-awake and AppState (no accelerometer yet).
6. **Log set.** Log/edit set screen with picker, previous sets, prefill, validation, delete.
7. **Rest UI & sensors.** `RestBar`, countdown tick + vibration (T4), accelerometer wiring to the detector, permission request (D14) and hint (T6), D13 overrides.
8. **Exercises, progress, history.** Exercise list/add/delete, `LineChart`, progress screen, history list/detail/delete.
9. **Polish.** Empty states, confirmation dialogs review, run the G.a grep, update `README.md` with how to run on a phone.

After steps 5–9 the human runs the manual checks of §8 on the iPhone.

## 12. Known risks & accepted trade-offs

| # | Risk | Mitigation / decision |
|---|---|---|
| R1 | Expo Go in the App Store supports only the latest SDK (58 as of November 2026); when Expo releases a newer SDK, the App Store build stops opening this project until it is upgraded; an agent may install newer package versions or use newer APIs. | D2: `npx expo install` only; CLAUDE.md repeats it; `expo-doctor` may be run by the human when dependencies change. |
| R2 | Accelerometer works only with the app open and the screen on. | Keep-awake during an active workout (1.4a); higher battery use accepted. |
| R3 | Thresholds for "still" and "pickup" depend on the phone and surface (bench, floor). | Values in `src/config.ts`, tuned manually on the iPhone in step 7; the 10-second rule is fixed by SPEC. |
| R4 | sql.js in tests and expo-sqlite on the phone may differ in edge behaviour; `expoDb.ts` itself has no automated tests. | Only standard SQLite features (partial and expression indexes exist since SQLite 3.8/3.9); `PRAGMA foreign_keys` set by both adapters; no reliance on cascades (D17); serialised access (D16); dev-check write/read after step 1 and a full manual run after step 5. |
| R10 | Library docs consulted while writing this document partly showed newer SDK pages; SDK 58 details (notification trigger shape, handler fields) may differ slightly. | Packages pinned by `npx expo install`; TypeScript types of the installed versions are authoritative; the dev-check screen (D18) proves each capability on the phone before features depend on it. |
| R5 | User denies notification permission. | Timers still work in the app; one-time hint (T6). |
| R6 | iOS may kill the app in the background. | All timer state is persisted (D10); the scheduled notifications are owned by iOS and still fire. |
| R7 | Vibration in the gym may be missed. | Accepted for v1; the countdown is also visible on screen. |
| R8 | Development is on Windows: no iOS Simulator, no local iOS build. | Test on the physical iPhone via Expo Go; `expo export` is the agents' build check. |
| R9 | One `/implement` run over the whole document is too large to review. | §11: one run per step. |
