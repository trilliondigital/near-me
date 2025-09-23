# Code Quality & Standards

This repository uses a consistent set of linters and formatters across platforms to keep the codebase professional and production-ready.

## Global

- EditorConfig: see `.editorconfig` for line endings, indentation, and whitespace rules.
- Prettier: see `.prettierrc` and `.prettierignore`. Prettier is used for markdown and general formatting. (Not enforced in CI yet.)
- Git attributes: `.gitattributes` normalizes line endings and handles binary files.
- Node version: `.nvmrc` pins Node 18 for backend work.

## Backend (Node + TypeScript)

- ESLint configured in `backend/.eslintrc.cjs` with `@typescript-eslint`. Scripts in `backend/package.json` already include `lint`, `lint:fix`, and `build`.
- Lint target is `src/**/*.ts` by default; `dist/`, `coverage/`, `src/dashboard/` are ignored.

Commands:
- `npm run lint`      — lints TypeScript files
- `npm run lint:fix`  — attempts to automatically fix issues
- `npm run build`     — typechecks and compiles

## iOS (Swift)

- SwiftLint configured via `.swiftlint.yml`.
- In CI, SwiftLint is installed on the macOS runner and executed at repo root (targets `NearMe/`).

Local usage:
- Install via Homebrew: `brew install swiftlint`
- Run: `swiftlint --strict` (from repo root)

## Android (Kotlin/Gradle)

- Spotless plugin with ktlint for Kotlin formatting and Gradle file formatting.
- Run checks: `./gradlew spotlessCheck`
- Apply fixes: `./gradlew spotlessApply`

## Pre-commit Hooks (optional)

To enable pre-commit checks locally, you can install Husky and lint-staged. From the repo root, run:

```bash
npm init -y # if no root package.json exists
npm install -D husky lint-staged prettier
npx husky install
npx husky add .husky/pre-commit "npm run -w backend lint && npm run -w backend build && git -c core.hooksPath=.husky diff --name-only --cached | xargs npx prettier --write"
```

You can customize lint-staged to format only changed files and run ESLint/SwiftLint/spotless as desired.

## CI

- Backend CI: runs `lint`, `build`, and `test` with Postgres/Redis services.
- Android CI: runs `spotlessCheck`, `lint`, `assembleDebug`, `testDebugUnitTest`.
- iOS CI: installs SwiftLint, builds, runs tests, uploads results.

If the formatting checks initially fail, run formatters locally (`swiftlint --fix` for Swift where applicable, `./gradlew spotlessApply` for Android, Prettier for docs) and commit the changes.
