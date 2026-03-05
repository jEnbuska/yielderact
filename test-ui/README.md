# yielderact examples

A small [Vite](https://vitejs.dev/) application that demonstrates the key
features of the **yielderact** library running in a real browser.

Three interactive demos are included:

| Demo                | What it shows                                                        |
| ------------------- | -------------------------------------------------------------------- |
| **Counter**         | Generator component with local `let` state and `rerender()`          |
| **Todo List**       | Array state, keyboard events, and conditional rendering              |
| **Context / Theme** | `createContext` / `useContext` — value passing without prop-drilling |

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18

---

## Running the examples locally

```bash
# 1. From the repository root, install the root-level dev dependencies
#    (this provides TypeScript and the build toolchain).
cd /path/to/yielderact
npm install

# 2. Move into the examples folder and install its dependencies.
cd examples
npm install

# 3. Start the Vite dev server.
npm run dev
```

Open **http://localhost:5173** in your browser.
The dev server resolves `yielderact` directly from the library source files
in `../src`, so there is no separate build step needed.

### TypeScript / editor support

If your editor shows _"Cannot find module 'yielderact' or its corresponding type
declarations"_, that is because `yielderact` is not installed as an npm package
here — it is resolved at runtime by the Vite alias above.

The `tsconfig.json` in this folder already contains a `paths` mapping that
points your TypeScript language server to the source files:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "yielderact": ["../src/index.ts"],
      "yielderact/jsx-runtime": ["../src/jsx-runtime.ts"],
      "yielderact/jsx-dev-runtime": ["../src/jsx-runtime.ts"]
    }
  }
}
```

This tells TypeScript (and VS Code / other editors) where to find the module
without needing a separate build or `npm link` step.

---

## How the JSX transform works

yielderact uses a **custom JSX factory** (`createElement`) instead of React's.
To compile TSX files correctly, a small Vite plugin is provided at the root of
the repository:

```
yielderact/
├── vite-plugin-yielderact.ts   ← the plugin
└── examples/
    └── vite.config.ts          ← uses the plugin
```

### What the plugin does

`vite-plugin-yielderact` tells Vite's built-in esbuild transform to use the
**automatic JSX runtime** from `yielderact/jsx-runtime`:

```ts
// vite.config.ts
import { yielderactPlugin } from '../vite-plugin-yielderact';

export default defineConfig({
  plugins: [yielderactPlugin()],
});
```

This is equivalent to adding the following to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "yielderact"
  }
}
```

With these settings in place every `.tsx` file is compiled without needing
`import { createElement, Fragment } from 'yielderact'` at the top of the file.

### Using the plugin in your own project

1. Copy `vite-plugin-yielderact.ts` into your project (or install yielderact
   once it is published to npm — the plugin will be included as a named export).
2. Add it to your `vite.config.ts`:

   ```ts
   import { defineConfig } from 'vite';
   import { yielderactPlugin } from './vite-plugin-yielderact';

   export default defineConfig({
     plugins: [yielderactPlugin()],
   });
   ```

3. Update your `tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "yielderact"
     }
   }
   ```

---

## Running the Playwright tests

The test suite verifies that all three demos render and behave correctly in
**Chromium**, **Firefox**, and **WebKit (Safari)**.

```bash
# 1. Install Playwright browsers (one-time setup)
npx playwright install --with-deps

# 2. Run the tests (the Vite dev server is started automatically)
npm test
```

Test screenshots are saved to `test-results/` after every run.

To see the Playwright HTML report:

```bash
npx playwright show-report playwright-report
```

---

## Building for production

```bash
npm run build    # outputs to examples/dist/
npm run preview  # serves the built output locally
```
