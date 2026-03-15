<p align="center">
  <img src="assets/wordmark.svg" alt="Y'ract" height="80" />
</p>

# Y'ract

> A minimal JSX UI library powered by JavaScript generator functions

**yract** uses plain JavaScript [generator functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) as components. Hooks are called with `yield*`, JSX is produced by `return`, and state lives in local variables managed by the framework. No magic, no hidden machinery.

---

## Installation

```bash
npm install yract
```

### JSX setup

Add to your `tsconfig.json` (recommended):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "yract"
  }
}
```

No manual imports needed — the automatic JSX transform handles everything. Full `JSX.IntrinsicElements` type checking for all HTML/SVG tags is included out of the box.

<details>
<summary>Classic JSX transform (alternative)</summary>

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "createElement",
    "jsxFragmentFactory": "Fragment"
  }
}
```

With the classic transform, import at the top of every JSX file:

```ts
import { createElement, Fragment } from 'yract';
```

</details>

---

## Quick start

```tsx
import { createRoot, useState } from 'yract';

function* Counter() {
  const [count, setCount] = yield* useState(0);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Clicked {count} times
    </button>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Counter />);
```

Components are generator functions. The body re-runs from the top on every render, but hook state persists across runs — there are no stale-closure problems.

---

## Features

### Hooks

All hooks are generators called with `yield*`.

```tsx
function* Timer() {
  const [tick, setTick] = yield* useState(0);

  yield* useEffect((signal) => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return <p>Seconds: {tick}</p>;
}
```

Available hooks: `useState`, `useEffect`, `useRef`, `useId`, `useMemo`, `useResolve`, `useResolveRaw`, `useRender`, `useResume`, `useUIPatch`, `usePatchContext`.

### Context

Pass data through the tree without prop-drilling.

```tsx
import { createContext, useContext } from 'yract';

const ThemeCtx = createContext<'light' | 'dark'>('light');

function* ThemedButton() {
  const theme = yield* useContext(ThemeCtx);
  return <button className={theme}>Click</button>;
}

function* App() {
  return (
    <ThemeCtx.Provider value="dark">
      <ThemedButton />
    </ThemeCtx.Provider>
  );
}
```

`useContext` supports optional selectors to skip rerenders when only unrelated fields change.

### Async data

`useResolve` pauses rendering while a promise is pending and shows a loading placeholder:

```tsx
function* UserProfile({ userId }: { userId: number }) {
  const user = yield* useResolve(
    {
      fn: (signal) => fetch(`/api/users/${userId}`, { signal }).then((r) => r.json()),
      loading: <p>Loading...</p>,
      error: <p>Failed to load</p>,
    },
    [userId],
  );
  return <div>{user.name}</div>;
}
```

The `fn` callback receives an `AbortSignal` that is automatically aborted when deps change or the component unmounts.

### Conditional rendering

`$shown` mounts/unmounts any element or component without shifting sibling positions:

```tsx
function* App() {
  const [open, setOpen] = yield* useState(false);
  return (
    <>
      <button onClick={() => setOpen((v) => !v)}>Toggle</button>
      <Modal $shown={open} />
    </>
  );
}
```

### Portals

Render children into a DOM node outside the render root:

```tsx
import { createPortal } from 'yract';

function* App() {
  return (
    <div>
      <h1>App</h1>
      {createPortal(<Modal />, document.getElementById('modal-root')!)}
    </div>
  );
}
```

Context and events flow through the component tree, not the DOM tree.

### UI patches (transitions)

Freeze DOM updates during async work, then apply all changes at once:

```tsx
import { startUIPatch, commitUIPatch } from 'yract';

async function navigate(next: string) {
  startUIPatch();
  try {
    const data = await fetchPageData(next);
    setPageData(data);
  } finally {
    commitUIPatch(); // all changes applied atomically
  }
}
```

Use `$patch="live"` on subtrees that should keep updating during a patch (e.g. clocks, animations). Use `useUIPatch` for component-scoped patches. Use `$deferred` to mark lower-priority subtrees for the cooperative scheduler.

---

## API reference

See the full [API documentation](docs/api.md) for detailed signatures, examples, and design decisions.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commands, and workflow.

---

## License

MIT
