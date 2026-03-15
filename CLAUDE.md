# CLAUDE.md - Yielderact Development Guide

## MANDATORY: READ FIRST

**You are an agent for Enbuska Software Oy. Before performing ANY action, you must read and adhere to the following:**

1.  **STRICT EXECUTION POLICY:** Follow the sequence below for every PR.
2.  **INSTRUCTION MAINTENANCE:** This file must stay current. If you encounter a process issue, add a new feature, or change a public API, you MUST propose an update to this `CLAUDE.md` file in the same PR.
3.  **NPM ONLY:** Never use `npx`. Use `npm run <script>`.

## STRICT EXECUTION POLICY

**Before pushing code or opening a PR, you MUST execute this sequence in order:**

1.  **Branch Sync:** `git checkout dev && git pull origin dev && git checkout -`
2.  **Dead Code Check:** `npm run knip`
3.  **Lint & Format:** `npm run lint:fix`
4.  **Type Check & Build:** `npm run build`
5.  **Type Check Examples:** `npm run typecheck:examples`
6.  **Unit Tests:** `npm test`
7.  **Visual Tests:** `npm run test:visual`
8.  **Documentation & CLAUDE.md:** \* Update `docs/api.md` if API changed.
    - Update `CLAUDE.md` if the workflow, scripts, or project structure changed.
9.  **Final Verification:** If any step fails, fix and **restart from Step 2.**

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
- `npm run typecheck` — Type-check including test files (no emit)
- `npm run typecheck:examples` — Type-check example components (catches `$children`/JSX issues)
- `npm test` — Run Jest unit tests (jsdom)
- `npm run test:visual` — Run Playwright visual tests
- `npm run knip` — Detect dead code, unused exports, and unused dependencies (Knip)
- `npm run lint` — Check lint & formatting (Biome)
- `npm run lint:fix` — Auto-fix lint & formatting issues
- `npm run format` — Auto-fix formatting only (Biome)
- `npm run format:check` — Check formatting without fixing (Biome)
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

| File                      | Responsibility                                                          |
| :------------------------ | :---------------------------------------------------------------------- |
| `jsx.ts`                  | VNode types, `createElement`, `createPortal`, `Portal`, `FrameworkProps`, `SpecialProps`, `Component` |
| `jsx-types.ts`            | Intrinsic element type definitions (HTML/SVG attribute types)           |
| `jsx-runtime.ts`          | Automatic JSX transform (`jsx`, `jsxs`, `jsxDEV`)                      |
| `events.ts`               | `SyntheticEvent` type and proxy-based event wrapper                     |
| `context.ts`              | `createContext`, `useContext`, `ProviderFunction`, context map helpers   |
| `index.ts`                | Public API re-exports                                                   |
| `render/types.ts`         | `RenderContext`, `ComponentInstance`, `Slot`, `HookState`               |
| `render/state.ts`         | `createRenderContext()`, active context pointer                         |
| `render/index.ts`         | `render()`, `createRoot()` entry points                                 |
| `render/mount.ts`         | DOM construction & generator component lifecycle                        |
| `render/reconciler.ts`    | Positional reconciliation (diff + patch)                                |
| `render/hooks-runtime.ts` | Hook descriptor dispatch, effect flushing, unmount                      |
| `render/helpers.ts`       | Type guards, shallow equality, props merging, `flattenChildren`         |
| `render/props.ts`         | `applyProps`, `updateProps`, `setRef`, `clearRef`                       |
| `render/scheduler.ts`     | Priority-aware cooperative scheduler                                    |
| `render/patch-queue.ts`   | Atomic DOM commit queue                                                 |
| `render/patch.ts`         | Global/local UI patch (`startUIPatch`/`commitUIPatch`)                  |
| `render/delegation.ts`    | Handler registry, `DelegationRoot`, prop→event mapping                  |
| `render/dispatch.ts`      | Delegated event dispatch (capture→bubble phases)                        |
| `render/events.ts`        | Per-element listeners for non-delegated events                          |
| `hooks/descriptors.ts`    | Hook type constants (`$USE_STATE`, etc.) and descriptor interfaces      |
| `hooks/types.ts`          | `ComponentGenerator`, `DependencyList`, `depsChanged()`                 |
| `hooks/*.ts`              | Individual hook implementations (`useState`, `useEffect`, etc.)         |

---

## Coding Standards & Rules

- **Self-Updating Documentation:** If you discover a "gotcha" or a more efficient way to run this project, update the "Non-Obvious Rules" or "Execution Policy" in this file immediately.
- **NPM Script Policy:** Never use `npx`. Always use the existing `npm run` scripts to ensure version consistency.
- **Linting:** Biome (`biome.json`) handles linting and formatting. Prettier was removed.
- **TypeScript:** Strictly typed; `any` is forbidden. `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` are enabled.
- **Special Props:** Always support the `$shown={boolean}` prop.
- **Dependencies:** Zero-dependency goal.
- **JSX Config:** The library build uses the classic `react` transform (`jsxFactory: "createElement"`). Consumers (including `examples/`) use `react-jsx` with `jsxImportSource: "yielderact"`, backed by `src/jsx-runtime.ts`.
- **Multi-root:** Each `render()`/`createRoot()` creates an independent `RenderContext` with its own state (patch depth, dirty instances, scheduler queue, context map, DOM ops queue). The global `idCounter` is the only shared state (IDs must be globally unique).
- **Guard Clauses:** Always prefer guard clauses (early returns) over nested conditionals. Return early when a condition short-circuits the rest of the logic.
- **Lint Strictness:** Never weaken linting or tsconfig rules. Fix lint issues by improving code, not by adding `biome-ignore` or `@ts-ignore` comments. The only accepted exceptions are `biome-ignore lint/complexity/noExcessiveCognitiveComplexity` on architectural dispatch functions (reconciler, props, mount, dispatch) that inherently require many branches.
- **Type Safety Tests:** Compile-time type tests live in `src/__tests__/*.typetest.tsx` and are checked by `npm run typecheck`.
- **New Feature Checklist:** Every new public API feature must include:
  1. An example demo component in `examples/src/components/` wired into `main.tsx` as a tab.
  2. Playwright visual tests in `playwright-tests/` covering the demo.
  3. Documentation in `docs/api.md`.
- **Bug Fix Workflow:** When a bug is discovered, always write unit tests and/or Playwright visual tests that reproduce the bug **before** writing the fix. Verify the tests fail, then fix the bug, then verify the tests pass.

### Examples Structure

Example components live in `examples/src/components/`. The app entry point is `examples/src/main.tsx`, which renders a tabbed view of all demos.

**Top-level demos** (each a tab in main.tsx): `Counter`, `TodoList`, `ThemeDemo`, `DataFetcher`/`ResolveRawDemo`, `HooksShowcase`, `ShownDemo`, `ConfirmDialog`, `EffectDemo`, `TransitionDemo`, `ContextDemo`, `LazyContextDemo`, `AbortSignalEffectDemo`, `KeyShuffleDemo`, `PortalDemo`.

**Multi-file demos** split one-component-per-file:

- **TransitionDemo:** Root imports `GlobalPatchDemo`, `LocalPatchDemo`, `GlobalVisibilityDemo`, `LocalVisibilityDemo`. Sub-components: `Navigation`, `Clocks` (→ `LiveClock`), `PageStubs`, `VisibilityTarget`.
- **ContextDemo:** Shared context definitions in `ContextDemo.shared.ts`. Leaf components: `ThemeBadge`, `LocaleBadge`, `BothBadge`, `StatefulConsumer`, `SiblingProvidersDemo`.
- **LazyContextDemo:** Shared context in `LazyContextDemo.shared.ts`. Consumers: `NoSelectorConsumer`, `SelectorConsumer`, `TransformConsumer`. Shared utility: `RenderBadge`.

**Utilities:** `examples/src/utils.ts` (`sleep`), `examples/src/types.ts` (`Page`).
