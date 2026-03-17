# Repository Guidelines

## Project Structure & Module Organization
This repository is an Expo React Native app. The main entry points are `index.ts` and `App.tsx`, which wire providers and navigation. Feature screens live in `screens/`, shared UI in `components/`, app state in `contexts/` and `providers/`, and reusable logic in `hooks/` and `lib/`. Navigation is defined in `navigation/`, design tokens in `theme/`, and static assets in `assets/`. Native Android files are under `android/`. Treat `dist/` as generated output, not hand-edited source.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm start` to launch the Expo dev server, `npm run android` to build and run the Android app locally, `npm run ios` for iOS on macOS, and `npm run web` to preview the web target. There is no dedicated lint or test script in `package.json` yet, so at minimum run `npx tsc --noEmit` before opening a PR to catch TypeScript regressions.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode expectations. Follow the existing style: 2-space indentation, double quotes, semicolons, and functional React components. Name screens, providers, and contexts in `PascalCase` (`LoginScreen.tsx`, `AuthContext.tsx`), hooks in `kebab-case` with a `use-` prefix (`use-push-notifications.ts`), and shared helpers with concise descriptive names in `lib/`. Keep platform-specific files explicit, for example `MapScreen.web.tsx`.

## Testing Guidelines
Automated tests are not configured yet. When adding tests, place them next to the source file or in a local `__tests__/` folder, and name them `*.test.ts` or `*.test.tsx`. Until a test runner is added, verify changes with `npx tsc --noEmit` and a manual Expo smoke test covering the affected screen or flow.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit messages such as `Add native push notifications`. Keep commits focused and write messages in that style. Pull requests should include a brief summary, impacted screens or modules, environment or schema changes, and screenshots or recordings for UI work. Link the related issue when one exists.

## Security & Configuration Tips
Copy `.env.example` to `.env` for local setup. Required variables include `EXPO_PUBLIC_API_URL`; `EXPO_PUBLIC_PROJECT_ID` is used for Expo project integration. Never commit real credentials or generated secrets.
