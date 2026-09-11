# CLAUDE.md - Y'ract Development Guide

## MANDATORY: READ FIRST

**You are an agent for Enbuska Software Oy. Before performing ANY action, you must read and adhere to the following:**

1.  **WORKTREE ONLY — NO EXCEPTIONS:** You must NEVER edit, create, or delete any files in the main repository checkout. ALL work (code, config, docs, tests — everything) MUST happen inside a worktree under `.worktrees/feat/<branch_name>`. The main repo folder must stay on `dev` and remain untouched. If you find yourself about to modify a file outside of `.worktrees/`, STOP and create a worktree first. The only exception is the `.claude/` directory in the main repo root, which may be edited directly (e.g. for settings and memory).
2.  **STRICT EXECUTION POLICY:** Follow the sequence below for every PR.
3.  **INSTRUCTION MAINTENANCE:** This file must stay current. If you encounter a process issue, add a new feature, or change a public API, you MUST propose an update to this `CLAUDE.md` file in the same PR.
4.  **NPM ONLY:** Never use `npx`. Use `npm run <script>`.
5.  **NODE 24 (CURRENT LTS):** Develop and test on Node 24. `engines` and `.nvmrc` declare it and CI runs it. This is a policy floor, not a technical one — the source needs nothing newer than Node 22 (`Array.prototype.toReversed`, `Promise.withResolvers`), so a failing test on an older runtime is a real failure, not a version mismatch.

## STRICT EXECUTION POLICY

**Before pushing code or opening a PR, you MUST execute this sequence in order:**

1.  **Branch Sync:** `git fetch origin dev && git rebase origin/dev`
2.  **Dead Code Check:** `npm run knip`
3.  **Lint & Format:** `npm run fix`
4.  **Type Check & Build:** `npm run build`
5.  **Type Check Playground:** `npm run typecheck:playground`
6.  **Unit Tests:** `npm test`
7.  **Visual Tests:** `npm run test:visual`
8.  **Documentation & CLAUDE.md:** \* Update `docs/api.md` if API changed.
    - Update `CLAUDE.md` if the workflow, scripts, or project structure changed.
9.  **Final Verification:** If any step fails, fix and **restart from Step 2.**

---

## Project Overview

yract is a minimal JSX UI library using JavaScript generator functions.

- **Components:** Generators using `yield*` for hooks and `return` for JSX.
- **State:** Local variables managed by hooks.
- **Core:** ~100 lines. Minimal, educational, transparent.

---

## Project Workflow

### 1. Starting a Task (Worktree Workflow)

Each branch gets its own worktree under `.worktrees/feat/` so multiple Claude Code sessions can work in parallel without conflicts. The main repo folder stays on `dev` and must NEVER be modified (except `.claude/`).

1. Check merged PRs: `gh pr list --state merged` — close resolved issues: `gh issue close <number>`
2. Ensure main repo `dev` is up to date: `git checkout dev && git pull origin dev` (from main repo root)
3. Create branch + worktree: `git worktree add .worktrees/feat/<dir_name> -b <branch_name>`
   - `<branch_name>` uses conventional commit prefixes: e.g. `feat/add-context`, `fix/render-bug`, `chore/cleanup`
   - `<dir_name>` is a **flat directory name** (no slashes) — strip the prefix: e.g. `add-context`, `render-bug`, `cleanup`
   - Example: `git worktree add .worktrees/feat/add-context -b feat/add-context`
   - **Never** create nested directories under `.worktrees/feat/` — all worktrees must be direct children
4. Install deps in worktree: `cd .worktrees/feat/<dir_name> && npm ci && npm ci --prefix playground`
5. Copy Claude Code settings: `mkdir -p .claude && cp <main-repo-root>/.claude/settings.local.json .claude/`
6. Work exclusively within the worktree directory — never edit files in the main repo root
7. Cleanup after merge: `git worktree remove .worktrees/feat/<dir_name> && git branch -d <branch_name>`

### 2. Development Commands

**Use `npm run <command>` only. No `npx`.**

- `npm run build` — Compile `src/` to `dist/` with declarations (`tsconfig.build.json`)
- `npm run typecheck` — Type-check including test files (no emit)
- `npm run typecheck:playground` — Type-check the playground
- `npm test` — Run Vitest unit tests (jsdom)
- `npm run test:visual` — Run Playwright visual tests (delegates to `playground`)
- `npm run knip` — Detect dead code, unused exports, and unused dependencies (Knip)
- `npm run lint` — Lint (oxlint, type-aware)
- `npm run lint:fix` — Auto-fix lint issues
- `npm run fix` — Auto-fix lint issues, then format (lint first: `--fix` can leave code needing a reformat)
- `npm run format` — Format (oxfmt)
- `npm run format:check` — Check formatting without writing
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

### 4. CI Workflows

- **`ci.yml`** — Runs on push to `dev`/`main` and all PRs. Steps: dead code check (`knip`), lint, test, build, then visual tests (Playwright).
- **`auto-resolve-conflicts.yml`** — Runs on push to `dev`. Finds open PRs targeting `dev` with merge conflicts and uses Claude Code CLI to resolve them automatically. Comments on the PR with the result. Requires `CLAUDE_CODE_OAUTH_TOKEN` secret.
- **`close-issues.yml`** — Runs when a PR is merged to `dev` or `main`. Parses the PR body for `Closes #N` / `Fixes #N` / `Resolves #N` and closes the linked issues.
- **`require-issue-link.yml`** — Runs on PR open/edit/sync targeting `dev` or `main`. Fails if the PR body does not contain a `Closes #N` / `Fixes #N` / `Resolves #N` reference.

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

| File                                  | Responsibility                                                                                              |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| `index.ts`                            | Public API re-exports                                                                                       |
| `jsx.ts`                              | `Child`/`Children`, `Component`, `FrameworkProps` (`key`, `shown`, `deps`), `Fragment`                      |
| `jsx-types.ts`                        | Intrinsic element type definitions (HTML/SVG attribute types)                                               |
| `jsx-runtime.ts`                      | Automatic JSX transform (`jsx`, `jsxs`, `jsxDEV`)                                                           |
| `events.ts`                           | `SyntheticEvent`/`SEvent` and the proxy-based event wrapper                                                 |
| `context.ts`                          | `createContext`, `resolveContext`, context map helpers                                                      |
| `general.ts` / `general-types.ts`     | Shared helpers and `ComponentGenerator`, `DependencyList`                                                   |
| `render-reasons.ts`                   | Symbols identifying why a fiber was scheduled                                                               |
| `hooks/*.ts`                          | One file per hook (`state`, `effect`, `memo`, `ref`, `context`, `id`, `load`, `halt`, `defer`, `stable`, …) |
| `hooks/constants.ts`                  | Hook type symbols (`$STATE`, `$EFFECT`, …)                                                                  |
| `hooks/types.ts`                      | Hook descriptor interfaces                                                                                  |
| `instances/component-fiber.ts`        | `ComponentFiber` — per-component state, queued UI actions, rerender                                         |
| `instances/context-fiber.ts`          | Context provider fiber                                                                                      |
| `instances/create-fiber.ts`           | Fiber construction                                                                                          |
| `slots/slot.ts`                       | `Slot` types (element, text, fragment, component, context)                                                  |
| `slots/intent.ts`                     | `Intent` — a slot before it is committed                                                                    |
| `slots/draft.ts`                      | Draft/partial slot types                                                                                    |
| `slots/slot-keys.ts`                  | Stable slot key derivation                                                                                  |
| `slots/utils.ts`                      | Slot inheritance and node preparation                                                                       |
| `reconciler/reconciler.ts`            | Reconciliation — walks intents against previous slots                                                       |
| `reconciler/actions.ts`               | `UIAction` union (`INSERT`/`MOVE`/`TEXT`/`UPDATE`/`REMOVE`) + `prepare*`                                    |
| `reconciler/dom-updates.ts`           | DOM primitives used at commit                                                                               |
| `reconciler/fiber-handlers.ts`        | Per-slot-kind handling during reconcile                                                                     |
| `reconciler/derive-stable-indexes.ts` | Keyed move minimisation                                                                                     |
| `render/root.ts` / `render/index.ts`  | `createRoot()`, `render()` entry points                                                                     |
| `render/scheduler.ts`                 | Cooperative scheduler; applies queued `UIAction`s at commit                                                 |
| `render/element-props.ts`             | `diffElementProps` (reconcile) → `ElementPatch` → `updateElementProps` (commit)                             |
| `render/delegation.ts`                | Handler registry, `DelegationRoot`, prop→event mapping                                                      |
| `render/dispatch.ts`                  | Delegated event dispatch (capture→bubble phases)                                                            |
| `render/events.ts`                    | Per-element listeners for non-delegated events                                                              |
| `render/types.ts`                     | `RenderContext`, hook state types                                                                           |

---

## Coding Standards & Rules

- **Self-Updating Documentation:** If you discover a "gotcha" or a more efficient way to run this project, update the "Non-Obvious Rules" or "Execution Policy" in this file immediately.
- **NPM Script Policy:** Never use `npx`. Always use the existing `npm run` scripts to ensure version consistency.
- **Linting:** oxlint (`.oxlintrc.json`) lints; oxfmt (`.oxfmtrc.json`) formats. They are separate tools — `lint` does not check formatting, so run `format:check` too.
- **TypeScript:** Strictly typed; `any` is forbidden. `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` are enabled.
- **Prefer `satisfies` over `as`:** Strongly avoid `as` type assertions. Use `satisfies` to validate that a value conforms to a type without silencing the type checker. Only use `as` where genuine type narrowing is required (e.g., DOM element downcasts, narrowing `T | undefined` to `T`, casting `unknown` from external APIs, generator yield values). Never use `as` when `satisfies` would work.
- **Special Props:** Always support the `shown={boolean}` prop (no `$` prefix — see `FrameworkProps` in `jsx.ts`, alongside `key` and `deps`).
- **Dependencies:** Zero-dependency goal.
- **JSX Config:** Both the library and consumers (including `playground/`) use the automatic `react-jsx` transform with `jsxImportSource: "yract"`, backed by `src/jsx-runtime.ts`.
- **Multi-root:** Each `render()`/`createRoot()` creates an independent `RenderContext` with its own state (scheduler queue, context map, DOM ops queue). The global `idCounter` is the only shared state (IDs must be globally unique).
- **Prefer Destructuring:** Use destructuring when extracting properties from objects (e.g., `const { gen } = instance` instead of `const gen = instance.gen`). For save/restore patterns use destructuring with rename (e.g., `const { activePriority: prevPriority } = rctx`).
- **Shorthand Properties:** Always use shorthand property syntax in object literals when the key matches the variable name (e.g., `{ instance }` instead of `{ instance: instance }`).
- **Guard Clauses:** Always prefer guard clauses (early returns) over nested conditionals. Return early when a condition short-circuits the rest of the logic.
- **Flat Code:** Avoid deeply nested blocks (`if` inside `if`, `try` inside `if`, etc.). Extract nested logic into separate functions, use early returns, or restructure to keep indentation shallow. Flat code is easier to read and maintain.
- **No Floating Promises:** Every call to a function that returns a `Promise` must be handled — use `await`, `void`, `.then()`, or `.catch()`. oxlint catches some cases, but its type inference cannot trace Promise-returning methods through interfaces or the generator `yield*` protocol (e.g., `useState` setters, `instance.executeRerender()`). You must manually prefix these with `void` (or `await` where appropriate). Common Promise-returning calls: `useState` setters, `instance.rerender()`, `instance.executeRerender()`.
- **Lint Strictness:** Never weaken linting or tsconfig rules. Fix lint issues by improving code, not by adding `oxlint-disable` or `@ts-ignore` comments. The only accepted exceptions are cognitive-complexity suppressions on architectural dispatch functions (reconciler, props, mount, dispatch) that inherently require many branches.
- **New Feature Checklist:** Every new public API feature must include:
  1. A demo section in `playground/src/sections/<route>/` wired into the router.
  2. Playwright visual tests in `playground/tests/` covering the demo.
  3. Documentation in `docs/api.md`.
- **Bug Fix Workflow:** When a bug is discovered, always write unit tests and/or Playwright visual tests that reproduce the bug **before** writing the fix. Verify the tests fail, then fix the bug, then verify the tests pass.

### Playground Structure

The playground is a separate package in `playground/`, aliased to the library
source (no build step between them). Its entry point is `playground/src/main.tsx`,
which mounts `App.tsx` — the shell that stacks every demo on one page.

- `playground/src/sections/<name>/index.tsx` — one folder per demo section.
- `playground/src/components/` — leaf components shared between sections.
- `playground/src/dos/` — the DOS text-mode UI kit used by the shell (`styles.css` plus one file per component).
- `playground/src/contexts.ts` — contexts shared across sections.
- `playground/tests/` — Playwright specs; `helpers.ts` holds `goToApp` and the tab helpers.
