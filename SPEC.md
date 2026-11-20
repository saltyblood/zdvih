# Zdvih — Requirements Specification

Version 1 (MVP). Source: `project.md`. This document is written so that someone who was not part of the discussion can understand what the app must do and check it against the acceptance criteria.

## 1. Problem

People who lift regularly do not remember what weight and reps they did last time, so they cannot tell whether they are progressing or stuck.

## 2. Users and roles

| Role | Description |
|---|---|
| Lifter | The only role. A recreational gym-goer who trains 2–5 times a week with their own routine. Uses the app on their own phone. No account, no login. |

## 3. Initiative, epics, user stories

**Initiative:** help lifters see real progress. Target: 70 % of users who log at least 4 workouts open the progress chart of an exercise at least once.

| Epic | User story |
|---|---|
| 1. Workout session | As a lifter, I want to start and finish a workout with one tap, so that every gym visit is recorded with its date and duration. |
| 2. Set logging | As a lifter, I want to see what I lifted last time while I log a set, so that I know what to beat today. |
| 3. Rest timer | As a lifter, I want the rest timer to start when I pick my phone up after a set, so that I do not have to tap anything between sets. |
| 4. Exercises | As a lifter, I want a ready list of common exercises and the option to add my own, so that I can start logging immediately. |
| 5. Progress and history | As a lifter, I want a chart of my estimated max per exercise, so that I can see whether I am progressing or stuck. |

## 4. Functions

Each function in one sentence, from the user's point of view.

**1. Workout session**
- 1.1 I can start a workout with one tap.
- 1.2 I can finish the active workout, and it is saved with its date and duration.
- 1.3 If I close the app during a workout, the workout is still active when I return.
- 1.4 During a workout the screen stays on, so the phone can notice when I pick it up.
- 1.5 If I forget an open workout, the app reminds me after 30 minutes of inactivity.

**2. Set logging**
- 2.1 I can log a set by choosing an exercise and entering weight and reps.
- 2.2 While logging, I see the sets I did for that exercise in my previous workout.
- 2.3 I can edit or delete a set in the active workout.

**3. Rest timer**
- 3.1 When I pick up the phone after it has been lying still during a set, a 3-minute rest countdown starts by itself.
- 3.2 I can start the same countdown by hand with a "Start rest" button.
- 3.3 I can stop the countdown early.
- 3.4 When the rest is over, the phone vibrates and shows a notification, also when the screen is locked.

**4. Exercises**
- 4.1 I can choose from 14 built-in exercises grouped by muscle group.
- 4.2 I can add my own exercise with a name and a muscle group.

**5. Progress and history**
- 5.1 I can see a list of my past workouts, newest first.
- 5.2 I can open a past workout and see all its sets.
- 5.3 For each exercise I can see a chart of my estimated one-rep max over time.
- 5.4 I can delete a past workout.

## 5. Definitions

| Term | Definition |
|---|---|
| Active workout | A workout that has been started and not finished. At most one exists at a time. |
| Set | One entry of exercise + weight (kg) + reps, belonging to a workout. |
| Volume | Sum of `weight × reps` over the sets in question, in kg. |
| Estimated 1RM | Epley formula: `weight × (1 + reps / 30)`; for `reps = 1` it equals the weight. Rounded to 0.1 kg for display. |
| Best set of a workout (per exercise) | The set with the highest estimated 1RM for that exercise in that workout. |
| Previous workout (for an exercise) | The most recently finished workout that contains at least one set of that exercise. |
| Rest | A fixed 3-minute (180 s) countdown. |
| Still | The phone lies without movement above the threshold defined in the design document. |
| Pickup | Movement above that threshold after the phone has been still for at least 10 seconds. |
| Activity | Starting the workout, saving, editing or deleting a set, starting or stopping a rest. |

## 6. Acceptance criteria

Numbered by function. Each criterion is a yes/no check.

**1. Workout session**
- **1.1a** With no active workout, the home screen shows a "Start workout" button; tapping it creates an active workout with the current date and time as start.
- **1.1b** While a workout is active, "Start workout" is not available; a second active workout cannot be created.
- **1.2a** Tapping "Finish workout" and confirming stores the end time; the workout appears in history with its date and duration in minutes.
- **1.2b** A workout with zero sets is discarded on finish and does not appear in history.
- **1.3a** If the app is closed (or killed) during a workout and reopened, the same workout is active with all its sets.
- **1.4a** While a workout is active and the app is open, the screen does not lock automatically; after the workout is finished, the normal auto-lock applies again.
- **1.5a** If an active workout has no activity for 30 minutes, a notification "Your workout is still open" is shown.
- **1.5b** Any activity resets the 30-minute period; the reminder is shown at most once per inactivity period.
- **1.5c** The reminder does not finish the workout; it stays active until the user finishes it, and its duration includes the whole time.
- **1.5d** Finishing the workout cancels the pending reminder.

**2. Set logging**
- **2.1a** A set requires an exercise, a weight and reps; the "Save set" button is disabled until all three are valid.
- **2.1b** Weight accepts values greater than 0 and up to 500 kg with at most two decimal places; both `.` and `,` are accepted as the decimal separator.
- **2.1c** Reps accept whole numbers from 1 to 100.
- **2.1d** A saved set appears at once in the active workout's list, under its exercise, in the order it was logged.
- **2.2a** After choosing an exercise, the screen shows every set of that exercise from its previous workout (weight × reps) and the date of that workout.
- **2.2b** If the exercise has never been done, the screen shows "No previous sets" instead.
- **2.2c** The weight and reps fields are pre-filled with the values of the last set of the previous workout; the user can change them.
- **2.3a** A set in the active workout can be edited (weight, reps) with the same validation as 2.1b–2.1c, or deleted after a confirmation.

**3. Rest timer**
- **3.1a** During an active workout with the app open, if the phone has been still for at least 10 seconds and is then picked up, a 180-second countdown starts.
- **3.1b** A pickup while a countdown is already running does not restart or stop it.
- **3.1c** Moving the phone without a preceding still period of at least 10 seconds (e.g. while scrolling or typing) does not start a countdown.
- **3.1d** Saving a set does not start, stop or restart a countdown.
- **3.1e** No countdown starts automatically when no workout is active.
- **3.2a** The "Start rest" button starts the same 180-second countdown at any time during an active workout; if a countdown is running, it restarts from 180 s.
- **3.3a** A "Stop" button ends the countdown; no vibration or notification follows.
- **3.4a** When the countdown reaches 0 with the app open, the phone vibrates.
- **3.4b** When the countdown reaches 0 with the app in the background or the screen locked, a notification "Rest is over" is shown.
- **3.4c** Stopping or restarting a countdown cancels its pending notification, so no stale notification appears.
- **3.4d** If notification permission is denied, the countdown still works inside the app, and the user sees a one-time hint explaining that alerts with a locked screen are off.
- **3.4e** The remaining time stays correct after the app returns from the background (it is computed from the end time, not counted in the background).

**4. Exercises**
- **4.1a** On first launch the app contains exactly the 14 built-in exercises from `project.md`, grouped into 7 muscle groups.
- **4.1b** Built-in exercises cannot be renamed or deleted.
- **4.2a** A custom exercise requires a name (1–60 characters, trimmed) and one of the 7 muscle groups.
- **4.2b** A name that matches an existing exercise ignoring case and surrounding spaces is rejected with the message "Exercise already exists".
- **4.2c** A custom exercise can be deleted only if no set uses it; otherwise the delete option is not offered.

**5. Progress and history**
- **5.1a** History lists finished workouts newest first; each row shows date, start time, duration in minutes, number of sets and total volume in kg.
- **5.2a** Opening a workout shows its sets grouped by exercise, in logged order, with weight and reps.
- **5.3a** The progress screen of an exercise shows one point per workout: the estimated 1RM of the best set of that workout, ordered by date.
- **5.3b** With fewer than 2 workouts for the exercise, the screen shows "Log this exercise in at least 2 workouts to see progress" instead of a chart.
- **5.3c** Example for checking the formula: 100 kg × 5 reps gives 116.7 kg; 80 kg × 1 rep gives 80.0 kg.
- **5.4a** A past workout can be deleted after a confirmation; its sets disappear from history, from the "previous workout" display and from the progress chart.

**General**
- **G.a** All features work with the phone in airplane mode.
- **G.b** All data survives closing and reopening the app.

## 7. Constraints

- React Native with Expo **SDK 54**, TypeScript; must run in the App Store version of Expo Go on iPhone.
- Data stored only on the device (SQLite).
- UI language English; weight unit kg; dates and times in the phone's local time zone.
- Usable with one hand on a phone screen.
- Rest is fixed at 180 seconds; not configurable.
- The accelerometer is read only while the app is open and the screen is on; therefore the screen is kept on during an active workout (1.4a). Higher battery use during a workout is accepted.

## 8. Out of scope (v1)

| Not in v1 | Why |
|---|---|
| Automatic gym detection by GPS | Needs background location and a paid Apple build; "Start workout" replaces it. |
| Configurable rest length | One fixed value keeps the timer and its tests simple. |
| Bodyweight exercises in the built-in list | Weight 0 breaks the 1RM and volume formulas. |
| Editing sets of finished workouts | Only deleting a whole workout; keeps history logic simple. |
| Accounts, sync, backup, export | Need a backend. |
| Training plans, recommendations | A different problem. |
| Automatic rep counting | Unreliable with the phone not attached to the body. |
| Social features | Need a backend, no value for personal progress. |
| Body weight, measurements, photos | Separate feature area. |
| Apple Watch / Health | Native capabilities outside Expo Go. |
| lb unit, other languages | Keep v1 small. |

## 9. Decided questions

| # | Question | Decision |
|---|---|---|
| O1 | Can the automatic rest start be switched off? | No in v1; the user can tap "Stop". |
| O2 | What happens to a workout that was never finished? | It stays active; after 30 minutes without activity a reminder notification is sent (1.5). The duration includes the whole time. |
| O3 | Can a workout be started for a past date? | No in v1. |
| O4 | Who defines the movement threshold for "still" and "pickup"? | The design document; it is tuned on a real phone. The spec fixes only the 10-second still period. |
| O5 | What triggers the automatic rest? | Picking the phone up after the set, not putting it down: during a set the phone is not in the hands. |

## 10. Open questions

None.
