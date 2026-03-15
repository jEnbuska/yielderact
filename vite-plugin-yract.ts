/**
 * vite-plugin-yract
 *
 * A tiny Vite plugin that wires up the JSX automatic runtime for yract.
 *
 * Without React in the picture Vite's default transform does not know
 * which `jsx()` helper to call.  This plugin points the JSX transform at
 * yract's own jsx-runtime (`yract/jsx-runtime`) so that every `.tsx` / `.jsx`
 * file is compiled without needing an explicit `createElement` / `Fragment`
 * import at the top of every file.
 *
 * Usage in your `vite.config.ts`:
 *
 * ```ts
 * import { defineConfig } from 'vite';
 * import { yractPlugin } from '../vite-plugin-yract';
 *
 * export default defineConfig({
 *   plugins: [yractPlugin()],
 * });
 * ```
 *
 * Your `tsconfig.json` should include:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "jsx": "react-jsx",
 *     "jsxImportSource": "yract"
 *   }
 * }
 * ```
 *
 * **Note on Vite's development mode:** Vite resolves `yract/jsx-dev-runtime`
 * during dev. If yract is used from source (i.e. via a `resolve.alias`),
 * add the following extra alias in your `vite.config.ts`:
 *
 * ```ts
 * resolve: {
 *   alias: {
 *     'yract/jsx-dev-runtime': '<path-to>/src/jsx-runtime.ts',
 *   },
 * }
 * ```
 *
 * When using the published npm package this alias is not necessary because the
 * package ships a `./jsx-dev-runtime` export that maps to the same module.
 */
import type { Plugin } from "vite";

/**
 * Returns a Vite plugin that configures the JSX transform to use
 * yract's automatic JSX runtime.
 */
export function yractPlugin(): Plugin {
  return {
    name: "vite-plugin-yract",
    config() {
      return {
        oxc: {
          jsxImportSource: "yract",
        },
      };
    },
  };
}
