# yielderact

> JSX UI library focused on ease of use and easy to understanding the internals of the library itself

**yielderact** is a tiny, transparent JSX UI library that uses plain JavaScript
[generator functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*)
as components. Each `yield` statement produces the JSX for the current render.
State lives in ordinary local variables — no magic, no hidden framework machinery.

---

## How it works (in ~100 lines)

The whole library consists of three small modules:

| File                                       | What it does                                                  |
| ------------------------------------------ | ------------------------------------------------------------- |
| [`src/jsx.ts`](src/jsx.ts)                 | Defines the `VNode` type and the `createElement` JSX factory  |
| [`src/render.ts`](src/render.ts)           | Turns VNodes into real DOM nodes; mounts generator components |
| [`src/jsx-runtime.ts`](src/jsx-runtime.ts) | Automatic JSX transform support (`jsxImportSource`)           |

### Generator components

```tsx
import { createElement, render } from 'yielderact';

// A generator function IS a component.
// `rerender` – passed as the second argument – repaints the component
// by advancing the generator to its next `yield`.
function* Counter(_props: {}, rerender: () => void) {
  let count = 0;
  while (true) {
    yield (
      <button
        onClick={() => {
          count++;
          rerender();
        }}
      >
        Clicked {count} times
      </button>
    );
  }
}

render(<Counter />, document.getElementById('root')!);
```

### Lifecycle in plain English

1. `render(<Counter />, container)` creates a generator instance and calls
   `gen.next()` to get the **initial JSX**.
2. The resulting DOM node is placed inside a `<span style="display:contents">`
   host element (transparent to layout) and added to the container.
3. When `rerender()` is called (e.g. from an `onClick` handler), the library
   calls `gen.next()` again. The generator resumes, updates its local
   variables, and `yield`s new JSX.
4. The host element is cleared and repopulated with the new DOM nodes.
5. When the generator returns (`done: true`) it stops rerendering.

### Fragments

```tsx
import { createElement, Fragment, render } from 'yielderact';

function* List() {
  yield (
    <>
      <li>One</li>
      <li>Two</li>
    </>
  );
}
```

---

## Installation

```bash
npm install yielderact
```

## TypeScript / JSX setup

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "createElement",
    "jsxFragmentFactory": "Fragment"
  }
}
```

…and import at the top of every JSX file:

```ts
import { createElement, Fragment } from 'yielderact';
```

Or use the automatic JSX transform:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "yielderact"
  }
}
```

Either configuration provides full JSX type checking out of the box —
including `JSX.IntrinsicElements` support for all HTML / SVG tags.
No additional `/// <reference>` directives or manual type imports are needed.

> **Local / monorepo usage (pre-publish)**
>
> If you are running yielderact directly from source (e.g. inside the
> `examples/` folder of this repo) and your editor shows
> _"Cannot find module 'yielderact'"_, add the following to your
> project's `tsconfig.json` so the TypeScript language server resolves
> the package from source:
>
> ```json
> {
>   "compilerOptions": {
>     "baseUrl": ".",
>     "paths": {
>       "yielderact": ["../src/index.ts"],
>       "yielderact/jsx-runtime": ["../src/jsx-runtime.ts"],
>       "yielderact/jsx-dev-runtime": ["../src/jsx-runtime.ts"]
>     }
>   }
> }
> ```

---

## Running the tests

```bash
npm test
```

---

## License

MIT
