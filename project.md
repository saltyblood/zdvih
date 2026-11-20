# Zdvih — gym workout log

Working title: **Zdvih** (Slovak for "lift"). A mobile app for logging strength training and seeing whether you are actually progressing.

## Problem

People who lift regularly do not remember what weight and reps they did last time, so they cannot tell whether they are progressing or stuck.

## Users

- **Primary:** recreational gym-goers who train 2–5 times a week, follow their own routine, and want to add weight or reps over time.
- **Not targeted:** personal trainers managing clients, competitive athletes with a coach, complete beginners who need a training plan.

One role only: the person using the phone. No accounts, no admin.

## Solution (MVP)

1. **Start and finish a workout.** One tap on "Start workout" opens a session; finishing it stores the date and duration. This doubles as the gym check-in.
2. **Log a set.** Pick an exercise, enter weight and reps, save. The values from the previous workout for that exercise are shown next to the input.
3. **Rest timer, automatic or manual.** During a set the phone lies on the side; picking it up after the set starts the rest countdown (accelerometer). The screen stays on during a workout so the pickup can be detected. A "Start rest" button starts the same countdown by hand. The rest is a fixed **3 minutes** for every exercise. When it ends, the phone vibrates and shows a notification.
4. **Exercise list.** A built-in list of two exercises per muscle group (see below), plus the option to add your own.
5. **Progress per exercise.** A chart of estimated one-rep max over time (Epley formula: `weight × (1 + reps / 30)`) and the best set of each workout.
6. **Workout history.** A list of past workouts with date, duration and total volume (sum of `weight × reps`).

All data is stored on the phone. The app works without an internet connection. The UI is in **English**.

### Built-in exercises

| Muscle group | Exercise 1 | Exercise 2 |
|---|---|---|
| Chest | Barbell Bench Press | Incline Dumbbell Press |
| Back | Lat Pulldown | Seated Cable Row |
| Shoulders | Overhead Barbell Press | Dumbbell Lateral Raise |
| Biceps | Barbell Curl | Dumbbell Hammer Curl |
| Triceps | Cable Triceps Pushdown | Overhead Dumbbell Triceps Extension |
| Quads | Barbell Back Squat | Leg Press |
| Hamstrings & glutes | Romanian Deadlift | Lying Leg Curl |

Every built-in exercise is loaded with external weight, so weight is always greater than 0.

## Non-goals — and why

| Not in the MVP | Why |
|---|---|
| Automatic gym detection by GPS | Needs background location with the "Always" permission and a paid Apple Developer build; saves a single tap. Replaced by the manual "Start workout" button. |
| Configurable rest length (per exercise or global) | One fixed 3-minute rest keeps the timer logic and its tests simple; a setting can be added later. |
| Bodyweight exercises (pull-ups, dips, abs) in the built-in list | Weight 0 or "bodyweight + extra" breaks the 1RM and volume formulas; needs its own rules. |
| Accounts, cloud sync, backup | Requires a backend and authentication; the MVP is single-device. |
| Training plans and exercise recommendations | A different problem (what to train), not the one being solved (did I progress). |
| Automatic rep counting from sensors | Unreliable with a phone that is not attached to the body or the bar; manual entry takes seconds. |
| Social features, sharing, leaderboards | No value for tracking personal progress; needs a backend. |
| Body weight, measurements, progress photos | Separate feature area; can be added after the core log works. |
| Apple Watch / Health integration | Needs native capabilities outside Expo Go. |
| Unit switching (lb) and other UI languages | One unit (kg) and one UI language (English) keep the first version small. |

## Technologies

| Area | Choice | Reason |
|---|---|---|
| Framework | React Native with Expo, **SDK 54**, TypeScript | Development on Windows, testing on a real iPhone through Expo Go. SDK 54 is the version the App Store build of Expo Go supports. |
| Storage | `expo-sqlite` (local SQLite database) | Offline, relational data (workouts → sets → exercises), no backend. |
| Sensors | `expo-sensors` (accelerometer) | Detect that the phone was put down to start the rest timer. |
| Feedback | `expo-haptics`, `expo-notifications` (local notifications) | Signal the end of rest, also when the screen is locked. |
| Navigation | Expo Router | Default in the Expo template. |
| Charts | A React Native chart library (to be chosen in the design document) | Progress chart per exercise. |
| Tests | Jest | Unit tests for the calculations (estimated 1RM, volume, timer logic). |
| Target devices | iPhone (primary, tested on iPhone 17 Pro); Android emulator as a fallback | Same codebase runs on both. |

### Phone hardware used

- Accelerometer — automatic start of the rest timer when the phone is picked up
- Screen wake lock (`expo-keep-awake`) — keeps the screen on during a workout
- Vibration motor — end of rest
- Local notifications — end of rest with a locked screen; reminder about an open workout
- Local storage — all workout data

## Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Does the rest timer start automatically only? | Both: automatically when the phone is picked up after lying still during a set, and manually with a "Start rest" button. |
| Q5 | Forgotten open workout | A reminder notification after 30 minutes of inactivity; the workout stays open. |
| Q2 | Rest length | Fixed 3 minutes for every exercise in the MVP. |
| Q3 | Built-in exercises | Two per muscle group, 14 in total (table above). |
| Q4 | UI language | English. |
