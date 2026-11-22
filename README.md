# Zdvih

Zdvih is an offline gym workout log for one user, built with React Native and Expo. You start a workout, log sets (exercise, weight, reps) while seeing the sets of your previous workout for the same exercise, and finish the workout. A 180-second rest countdown starts when you pick the phone up after it lay still for 10 seconds (or with a button) and ends with a vibration or a notification. History lists finished workouts, and a progress screen charts the estimated 1RM per workout. Everything is stored in a local SQLite database; the app never uses the network.

## Prerequisites

- A Windows development machine (PowerShell or Git Bash) with Node.js and npm.
- An iPhone with **Expo Go** installed from the App Store. The app targets **Expo SDK 58**, which is the SDK the App Store version of Expo Go supports (design D2). Do not change the SDK or install `expo-*` / `react-native-*` packages with plain `npm install`; use `npx expo install <pkg>`.
- There is no Mac, iOS Simulator or local iOS build in this workflow.

## Install and check

Run from the repository root:

```
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run build` runs `expo export --platform ios --output-dir dist`, which bundles the JS with Metro to prove the app compiles (`dist/` is git-ignored).

## Run on the iPhone

1. `npx expo start`
2. Scan the QR code with the iPhone camera; it opens in Expo Go.
3. The phone and the PC must be on the same network (and Windows must treat it as a *Private* network, otherwise the firewall blocks the phone). If that is not possible, use a tunnel. In SDK 58 the default tunnel is Expo's own and requires an Expo account (free, created at expo.dev):

   ```powershell
   npx expo login
   npx expo start --tunnel
   ```

   Sign in to the same account in Expo Go on the iPhone. Without logging in, `--tunnel` stops with "You're not logged in to your Expo account"; `npx expo start --tunnel ngrok` is the legacy alternative that does not need an account.
4. If `npx expo start` prints `TypeError: fetch failed`, the PC cannot reach Expo's servers; `npx expo start --offline` skips those calls (LAN only, not with `--tunnel`).

Close other Metro instances first; a running `npx expo start` can lock files and make `npm ci` fail with EPERM on Windows.

## Use it at the gym (PC stays at home)

Expo Go loads the app's code from Metro on your PC. With a tunnel the phone reaches the PC over the internet, so you can train with the PC running at home. (Opening an `eas update` in the App Store Expo Go is not supported; a build without the PC needs an Apple Developer account and EAS Build.)

1. Keep the PC awake: *Settings → System → Power* → set sleep to **Never** while plugged in. Avoid pending Windows updates that may restart it.
2. Open a **new** PowerShell window (so no D13 test overrides are set) and start the tunnel:

   ```powershell
   npx expo login
   npx expo start --tunnel
   ```

   Leave the window open.
3. Open Zdvih in Expo Go **before** you leave (or on the way, with mobile data) and do not swipe Expo Go away. Once loaded, the workout, sets and rest timer work without any connection.
4. At the gym the phone needs mobile data only if Expo Go has to reload the app (after iOS closed it or you swiped it away).

If the tunnel drops or the PC restarts while Expo Go is closed, the app cannot open until Metro runs again. Your data is safe: it is stored on the phone, and an unfinished workout is restored when the app opens. This is a development session, so an error shows the red developer screen instead of a normal message.

## Dev-only time overrides (D13)

In development (`__DEV__`) two environment variables shorten the timers so they can be tested by hand. They are ignored in non-development builds.

| Variable | Default | Meaning |
|---|---|---|
| `EXPO_PUBLIC_REST_SECONDS` | 180 | Rest countdown length |
| `EXPO_PUBLIC_REMINDER_SECONDS` | 1800 | Inactivity reminder delay |

PowerShell (set before starting Metro; `-c` clears the cache so the new values are inlined):

```
$env:EXPO_PUBLIC_REST_SECONDS = "15"
$env:EXPO_PUBLIC_REMINDER_SECONDS = "60"
npx expo start -c
```

To go back to the defaults: `Remove-Item Env:EXPO_PUBLIC_REST_SECONDS, Env:EXPO_PUBLIC_REMINDER_SECONDS` and restart with `-c`.

## Device check screen (D18) and detector tuning (R3)

In development the home screen shows a "Device check" link to `app/dev-check.tsx`. It offers a notification in 10 seconds, vibration, a keep-awake toggle, a live accelerometer read-out with the per-sample delta, and a SQLite write/read test. Use the delta read-out to tune the pickup detector: the thresholds (`stillMaxDelta`, `pickupMinDelta`) are in `DETECTOR` in `src/config.ts`. The 10-second stillness rule is fixed by the spec.

## Data and privacy

All data lives in a local SQLite database (`zdvih.db`) inside the app's sandbox on the phone. There is no backend, no network access and no analytics. **While you run Zdvih in Expo Go, the database lives in Expo Go's sandbox: deleting Expo Go deletes your workouts** (iOS has no way to clear the data of a single project inside it). In a standalone build, deleting the app deletes them. There is no export or backup in v1.

## Documents

- `SPEC.md`: requirements and numbered acceptance criteria.
- `zdvih-design.md`: authoritative implementation design (data model, rules, commands, implementation order).
- `project.md`: problem, users, MVP and non-goals.
- `CLAUDE.md`: rules for coding agents working in this repository.
