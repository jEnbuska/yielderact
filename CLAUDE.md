# CLAUDE.md - Yielderact Development Guide

## ⚠️ MANDATORY: READ FIRST
**You are an agent for Enbuska Software Oy. Before performing ANY action or answering ANY prompt, you must read the "STRICT EXECUTION POLICY" below. This is your primary directive.**

## ⚠️ STRICT EXECUTION POLICY
**Before pushing any code or opening a PR, you MUST execute this sequence in order. Do not skip steps.**

1.  **Branch Sync:** `git checkout dev && git pull origin dev && git checkout -`
2.  **Lint & Format:** `npm run format`
3.  **Type Check & Build:** `npm run build` (Ensures no TS errors)
4.  **Unit Tests:** `npm test`
5.  **Visual Tests:** `npm run test:visual`
6.  **Documentation:** If API changed, update `docs/api.md`.
7.  **Final Verification:** If any of the above failed, fix the code and **restart the sequence from Step 2.**

---

## Project Overview
yielderact is a minimal JSX UI library using JavaScript generator functions.
* **Components:** Generators using `yield*` for hooks and `return` for JSX.
* **State:** Local variables managed by hooks.
* **Core:** ~100 lines of code for transparency.

---

## Project Workflow

### 1. Starting a Task
* Check for merged PRs: `gh pr list --state merged`
* Close resolved issues: `gh issue close <number>`
* Create branch: `feature/description` or `fix/description` from `dev`.

### 2. Development Commands
**Note: Always use `npm run <command>` instead of `npx`.**

* `npm run build` — Compile TS to `dist/`
* `npm test` — Run Jest unit tests (jsdom)
* `npm run test:visual` — Run Playwright visual tests
* `npm run format` — Fix formatting with Prettier
* `npm run format:check` — Verify formatting
* `npm test -- <path>` — Run specific test file (e.g., `src/__tests__/hooks.test.ts`)

### 3. Creating a Pull Request
* **Target Branch:** `dev`
* **Commit Format:** Conventional Commits (e.g., `feat:`, `fix:`, `refactor:`, `docs:`)
* **PR Title:** `[Scope]: Brief Description`
* **Body Template:**
    * **Summary:** 2-3 sentences on what changed.
    * **Changes:** Bullet points of specific code modifications.
    * **Verification:** Confirm `npm test`, `npm run test:visual`, and `npm run build` passed.

---

## Technical Architecture

### Component Model
Components use `yield*` for hooks and `return` for JSX:

```tsx
function* Counter(_props: object) {
  const [count, setCount] = yield* useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

### Core Module Map
| File | Responsibility |
| :--- | :--- |
| `jsx.ts` | VNode types & `createElement` factory |
| `render.ts` | Reconciliation, DOM mounting, and synthetic events |
| `hooks.ts` | State management (`useState`, `useMemo`, `useRef`, etc.) |
| `context.ts` | `createContext` and `useContext` |
| `events.ts` | `SyntheticEvent` wrapper |
| `jsx-runtime.ts` | Automatic JSX transform entry points |

---

## Coding Standards & Rules
* **NPM Script Policy:** Never use `npx`. Always check `package.json` and use the existing `npm run` scripts to ensure version consistency.
* **TypeScript:** Use strictly; `any` is forbidden.
* **No Manual Edits:** Never modify `package-lock.json` manually.
* **Canonical API:** `docs/api.md` must be updated if any public API changes.
* **Special Props:** Always support the `$shown={boolean}` prop for conditional rendering.
* **Dependencies:** Avoid external dependencies to keep the core minimal.
* **JSX Config:** Use `react-jsx` with `jsxImportSource: "yielderact"`.