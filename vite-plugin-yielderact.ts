/**
 * vite-plugin-yielderact
 *
 * A tiny Vite plugin that wires up the JSX automatic runtime for yielderact.
 *
 * Without React in the picture Vite's default esbuild transform does not know
 * which `jsx()` helper to call.  This plugin points esbuild at yielderact's
 * own jsx-runtime (`yielderact/jsx-runtime`) so that every `.tsx` / `.jsx`
 * file is compiled without needing an explicit `createElement` / `Fragment`
 * import at the top of every file.
 *
 * Usage in your `vite.config.ts`:
 *
 * ```ts
 * import { defineConfig } from 'vite';
 * import { yielderactPlugin } from '../vite-plugin-yielderact';
 *
 * export default defineConfig({
 *   plugins: [yielderactPlugin()],
 * });
 * ```
 *
 * Your `tsconfig.json` should include:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "jsx": "react-jsx",
 *     "jsxImportSource": "yielderact"
 *   }
 * }
 * ```
 *
 * **Note on Vite's development mode:** Vite resolves `yielderact/jsx-dev-runtime`
 * during dev. If yielderact is used from source (i.e. via a `resolve.alias`),
 * add the following extra alias in your `vite.config.ts`:
 *
 * ```ts
 * resolve: {
 *   alias: {
 *     'yielderact/jsx-dev-runtime': '<path-to>/src/jsx-runtime.ts',
 *   },
 * }
 * ```
 *
 * When using the published npm package this alias is not necessary because the
 * package ships a `./jsx-dev-runtime` export that maps to the same module.
 */
import type { Plugin } from "vite";

/**
 * Returns a Vite plugin that configures the esbuild JSX transform to use
 * yielderact's automatic JSX runtime.
 */
export function yielderactPlugin(): Plugin {
  return {
    name: "vite-plugin-yielderact",
    config() {
      return {
        esbuild: {
          jsx: "automatic",
          jsxImportSource: "yielderact",
        },
      };
    },
  };
}
