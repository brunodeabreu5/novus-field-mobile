# Repository Guidelines

## Project Structure & Module Organization
This repository is an Expo React Native app. The main entry points are `index.ts` and `App.tsx`, which wire providers and navigation. Feature screens live in `screens/`, shared UI in `components/`, app state in `contexts/` and `providers/`, and reusable logic in `hooks/` and `lib/`. Navigation is defined in `navigation/`, design tokens in `theme/`, and static assets in `assets/`. The repo currently versions iOS native files, while Android native output is expected to be generated via Expo prebuild/run or EAS Build. Treat generated build output as non-source.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm start` to launch the Expo dev server, `npm run android` to prebuild and run Android locally, `npm run ios` for iOS on macOS, and `npm run web` to preview the web target. Before opening a PR, run `npm run test` for the lightweight unit checks and `npm run check` for the full local gate.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode expectations. Follow the existing style: 2-space indentation, double quotes, semicolons, and functional React components. Name screens, providers, and contexts in `PascalCase` (`LoginScreen.tsx`, `AuthContext.tsx`), hooks in `kebab-case` with a `use-` prefix (`use-push-notifications.ts`), and shared helpers with concise descriptive names in `lib/`. Keep platform-specific files explicit, for example `MapScreen.web.tsx`.

## Testing Guidelines
The repo includes a lightweight test script via `scripts/run-tests.mjs`. When adding tests, prefer keeping pure utility coverage in that script or add local `*.test.ts`/`*.test.tsx` files if a fuller runner is introduced later. For changes touching auth, tracking, push or permissions, pair `npm run check` with a manual Expo smoke test on the affected flow.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit messages such as `Add native push notifications`. Keep commits focused and write messages in that style. Pull requests should include a brief summary, impacted screens or modules, environment or schema changes, and screenshots or recordings for UI work. Link the related issue when one exists.

## Security & Configuration Tips
Copy `.env.example` to `.env` for local setup. Required variables include `EXPO_PUBLIC_API_URL`; `EXPO_PUBLIC_PROJECT_ID` is optional and should only be set when you have a real Expo/EAS project UUID for push. Never commit real credentials or generated secrets.
