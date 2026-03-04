# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

yielderact is a minimal JSX UI library that uses JavaScript generator functions as components. Each `yield*` calls hooks, and the function `return`s JSX for the current render. State lives in ordinary local variables managed by hooks. The entire core implementation is ~100 lines, making it educational and transparent.

## Commands

```bash
npm run build          # TypeScript compilation to dist/
npm test               # Run Jest unit tests (jsdom)
npm run test:visual    # Run Playwright visual tests
npm run format         # Format code with Prettier
npm run format:check   # Check formatting
```

Run a single test file:

```bash
npm test -- src/__tests__/hooks.test.ts
```

## Architecture

### Core Modules (in `src/`)

| File             | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `jsx.ts`         | `VNode` type, `createElement` factory, `Fragment` symbol          |
| `render.ts`      | VNode → DOM, reconciliation, component mounting, synthetic events |
| `hooks.ts`       | `useState`, `useRef`, `useId`, `useMemo`, `useResolve`            |
| `context.ts`     | `createContext`, `useContext`, Provider components                |
| `events.ts`      | `SyntheticEvent` wrapper for native DOM events                    |
| `jsx-runtime.ts` | Automatic JSX transform (`jsx`, `jsxs`, `jsxDEV`)                 |
| `jsx-types.ts`   | TypeScript definitions for all HTML/SVG attributes                |

### Component Model

Generator components use `yield*` to call hooks and `return` to output JSX:

```tsx
function* Counter(_props: object) {
  const [count, setCount] = yield* useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Clicked {count} times</button>;
}
```

Hooks use module-level context (`_hookStates`, `_hookIndex`) set by the renderer before each generator run. The reconciler tracks component instances via `GenInstance` objects stored in a WeakMap.

### Key Patterns

- **Synthetic events**: All `onXxx` handlers receive `SyntheticEvent` wrapping native events
- **`$shown` prop**: Any element/component accepts `$shown={boolean}` for conditional rendering
- **Shallow equality**: Props compared shallowly for component memoization
- **Fragment flattening**: `<>...</>` children flattened into parent during reconciliation
- **Context capture**: Context values captured at mount, persisted across re-renders

## JSX Configuration

Classic transform:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "createElement",
    "jsxFragmentFactory": "Fragment"
  }
}
```

Automatic transform:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "yielderact"
  }
}
```

## Examples

The `examples/` directory contains a Vite app demonstrating all features. Run with:

```bash
cd examples && npm install && npm run dev
```

Uses `vite-plugin-yielderact.ts` from the root to configure the JSX transform.

## Pull Request Conventions (CRITICAL)

1. **Branching:** Before creating a new branch, always pull the latest `dev` (`git checkout dev && git pull origin dev`) to avoid unnecessary merge conflicts. Then create a new branch using the format `feature/description` or `fix/description`. PR should be pointed to dev branch.
2. **Commit Message:** Use Conventional Commits (e.g., `feat: add login validation`).
3. **PR Title:** Follow the pattern `[Scope]: Brief Description`.
4. **PR Body Template:** Use the following structure for the description:
   - **Summary:** 2-3 sentences on what changed.
   - **Changes:** Bullet points of specific code modifications.
   - **Testing:** All tests should pass and new features and changes should be tested on the src level and in examples
   - **Lint and formatting:** All linting and (prettier) formatting should pass
   - **Build:** Build should occur without any error
   - **Documentation:** If the PR adds, changes, or removes any public API (hooks, props, behaviour), `docs/api.md` must be updated in the same PR.
5. **Sync with dev:** After the first commit on a new branch, always merge or rebase with `dev` and fix any conflicts before pushing.
6. **Execution:** Use the `gh` tool or internal git commands to push and open the PR.
7. **Close issues:** Before starting any new ticket, check for merged PRs (`gh pr list --state merged`) and close the GitHub issues they resolved (`gh issue close <number>`) if not already closed.

## Coding Standards

- Use **TypeScript** strictly; avoid `any`.
- Avoid adding external dependencies if not really necessary.

## Non-Obvious Rules

- Never modify `package-lock.json` manually.
- `docs/api.md` is the canonical API reference. Any PR that adds, changes, or removes public API (hooks, props, special behaviour) **must** update it. This includes new hooks, changed signatures, new special props, and behaviour changes.
