# CLAUDE.md - Yielderact Development Guide

## MANDATORY: READ FIRST

**You are an agent for Enbuska Software Oy. Before performing ANY action, you must read and adhere to the following:**

1.  **STRICT EXECUTION POLICY:** Follow the sequence below for every PR.
2.  **INSTRUCTION MAINTENANCE:** This file must stay current. If you encounter a process issue, add a new feature, or change a public API, you MUST propose an update to this `CLAUDE.md` file in the same PR.
3.  **NPM ONLY:** Never use `npx`. Use `npm run <script>`.

## STRICT EXECUTION POLICY

**Before pushing code or opening a PR, you MUST execute this sequence in order:**

1.  **Branch Sync:** `git checkout dev && git pull origin dev && git checkout -`
2.  **Lint & Format:** `npm run lint:fix`
3.  **Type Check & Build:** `npm run build`
4.  **Unit Tests:** `npm test`
5.  **Visual Tests:** `npm run test:visual`
6.  **Documentation & CLAUDE.md:** \* Update `docs/api.md` if API changed.
    - Update `CLAUDE.md` if the workflow, scripts, or project structure changed.
7.  **Final Verification:** If any step fails, fix and **restart from Step 2.**

---

## Project Overview

yielderact is a minimal JSX UI library using JavaScript generator functions.

- **Components:** Generators using `yield*` for hooks and `return` for JSX.
- **State:** Local variables managed by hooks.
- **Core:** ~100 lines. Minimal, educational, transparent.

---

## Project Workflow

### 1. Starting a Task

- Check merged PRs: `gh pr list --state merged`
- Close resolved issues: `gh issue close <number>`
- Create branch: `feature/description` or `fix/description` from `dev`.

### 2. Development Commands

**Use `npm run <command>` only. No `npx`.**

- `npm run build` — Compile TS to `dist/`
- `npm test` — Run Jest unit tests (jsdom)
- `npm run test:visual` — Run Playwright visual tests
- `npm run lint` — Check lint & formatting (Biome)
- `npm run lint:fix` — Auto-fix lint & formatting issues
- `npm run format` — Auto-fix formatting only (Biome)
- `npm test -- <path>` — Run specific test file

### 3. Creating a Pull Request

- **Target Branch:** `dev`
- **Commit Format:** Conventional Commits (e.g., `feat:`, `fix:`)
- **Issue Linking:** Every PR must link to a GitHub issue. If no issue exists for the work being done, create one first with `gh issue create`. Include `Closes #<number>` or `Fixes #<number>` in the PR body so the issue is automatically closed when the PR is merged.
- **PR Body Template:**
  - **Summary:** 2-3 sentences.
  - **Changes:** Bullet points.
  - **Closes:** `Closes #<issue>` or `Fixes #<issue>` (if applicable).
  - **Verification:** Confirm all `npm` checks passed.
  - **CLAUDE.md Update:** State if this file was updated to reflect new changes.

---

## Technical Architecture

### Component Model

```tsx
function* Counter(_props: object) {
  const [count, setCount] = yield* useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>;
}
```

### Core Module Map

| File             | Responsibility                      |
| :--------------- | :---------------------------------- |
| `jsx.ts`         | VNode types & `createElement`       |
| `render.ts`      | Reconciliation & DOM mounting       |
| `hooks.ts`       | State management (`useState`, etc.) |
| `jsx-runtime.ts` | Automatic JSX transform             |

---

## Coding Standards & Rules

- **Self-Updating Documentation:** If you discover a "gotcha" or a more efficient way to run this project, update the "Non-Obvious Rules" or "Execution Policy" in this file immediately.
- **NPM Script Policy:** Never use `npx`. Always use the existing `npm run` scripts to ensure version consistency.
- **Linting:** Biome (`biome.json`) handles linting and formatting. Prettier was removed.
- **TypeScript:** Strictly typed; `any` is forbidden. `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` are enabled.
- **Special Props:** Always support the `$shown={boolean}` prop.
- **Dependencies:** Zero-dependency goal.
- **JSX Config:** `react-jsx` with `jsxImportSource: "yielderact"`.
