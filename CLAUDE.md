# Zdvih — project rules for Claude Code

Zdvih is an offline gym workout log built with React Native and Expo. These rules apply to every session and every subagent in this repository.

## Documents (read before changing code)

| File | Role |
|---|---|
| `zdvih-design.md` | **Authoritative** implementation spec: data model, interfaces, rules, commands, implementation order. |
| `SPEC.md` | Requirements and numbered acceptance criteria (e.g. 2.1b). The design references them. |
| `project.md` | Problem, users, MVP, non-goals. Background only. |

- Never edit `SPEC.md`, `zdvih-design.md` or `project.md` unless the user asks. If the design cannot be followed, do the closest faithful thing and record the deviation in your report.
- Work only on the step you were given (`/implement zdvih-design.md <step>`). Earlier steps are already in the codebase; later steps are not yours.

## Stack rules

- Expo **SDK 58** exactly. The App Store version of **Expo Go** for iPhone supports only the latest SDK (58 as of November 2026), and the app must run in it. Never change the SDK unless the user asks.
- Add any `expo-*` or `react-native-*` package only with `npx expo install <pkg>`. Pure-JS dev tools (vitest, sql.js, eslint) with `npm install -D`.
- No native code, no config plugins that need a development build, no `expo prebuild`.
- No network access in app code: no `fetch`, `axios`, `XMLHttpRequest`, analytics or remote services.
- TypeScript `strict`. UI text and code in English; all UI strings live in `src/strings.ts`.
- Code in `src/domain`, `src/db` (except `expoDb.ts`), `src/repos` and `src/services` must not import `react-native`, `expo-*` or React (design D3).
- Weights are integer centi-kilograms; timestamps are epoch milliseconds (design D5, D6).

## Commands (exactly these, from the repo root)

```
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Run every command that exists at the current step before reporting. Never disable, skip or delete a failing test; fix the cause. `npx expo start` is for the human only.

## Environment

- The developer works on **Windows** (PowerShell or Git Bash). Use npm scripts rather than shell-specific commands; no `rm -rf`, `export VAR=` or other Unix-only syntax inside `package.json` scripts.
- There is no Mac, no iOS Simulator and no local iOS build. The human tests on a physical iPhone through Expo Go.
- Step 1 only: `create-expo-app` refuses or conflicts in a non-empty folder. Generate the app with `npx create-expo-app@latest <temp-folder> --template default@sdk-58` outside the repo, then move its files into the repo root without overwriting `CLAUDE.md`, `SPEC.md`, `project.md`, `zdvih-design.md` or `.claude/`. Merge `.gitignore` instead of replacing it.

## Git

- Do not commit, push or merge unless the user asks. The human reviews and commits after each step.
