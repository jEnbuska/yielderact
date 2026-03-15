# Contributing to Y'ract

## Development setup

```bash
git clone https://github.com/jEnbuska/yract.git
cd yract
npm ci
npm ci --prefix examples
```

## Commands

| Command | Description |
| :--- | :--- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check including test files (no emit) |
| `npm run typecheck:examples` | Type-check example components |
| `npm test` | Run Vitest unit tests (jsdom) |
| `npm run test:visual` | Run Playwright visual tests |
| `npm run knip` | Detect dead code and unused exports |
| `npm run lint` | Check lint and formatting (Biome) |
| `npm run lint:fix` | Auto-fix lint and formatting issues |
| `npm run format` | Auto-fix formatting only |
| `npm test -- <path>` | Run a specific test file |

## Before opening a PR

Run the full check sequence:

```bash
npm run knip          # dead code check
npm run lint:fix      # lint and format
npm run build         # type check and build
npm run typecheck:examples  # type check examples
npm test              # unit tests
npm run test:visual   # visual tests
```

If any step fails, fix and re-run the full sequence.

## Pull request guidelines

- **Target branch:** `dev`
- **Commit format:** [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `chore:`)
- **Issue linking:** Every PR must link to a GitHub issue. Include `Closes #<number>` or `Fixes #<number>` in the PR body. If no issue exists for the work being done, create one first. A CI check enforces this — PRs without an issue reference will fail.

## Project structure

| Path | Description |
| :--- | :--- |
| `src/jsx.ts` | VNode types, `createElement`, `createPortal` |
| `src/jsx-types.ts` | HTML/SVG attribute type definitions |
| `src/jsx-runtime.ts` | Automatic JSX transform (`jsx`, `jsxs`, `jsxDEV`) |
| `src/events.ts` | `SyntheticEvent` type and proxy-based event wrapper |
| `src/context.ts` | `createContext`, `useContext`, context map helpers |
| `src/index.ts` | Public API re-exports |
| `src/render/` | Renderer: mount, reconciler, scheduler, patches, delegation |
| `src/hooks/` | Hook implementations (`useState`, `useEffect`, etc.) |
| `examples/` | Demo app with tabbed component examples |
| `docs/` | API reference and design documentation |

## JSX configuration

The library build uses the classic `react` transform (`jsxFactory: "createElement"`). Consumers (including `examples/`) use `react-jsx` with `jsxImportSource: "yract"`.

### Local / monorepo usage

If running yract directly from source and your editor shows "Cannot find module 'yract'", add path mappings to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "yract": ["../src/index.ts"],
      "yract/jsx-runtime": ["../src/jsx-runtime.ts"],
      "yract/jsx-dev-runtime": ["../src/jsx-runtime.ts"]
    }
  }
}
```

## License

MIT
