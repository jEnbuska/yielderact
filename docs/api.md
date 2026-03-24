# yract — API Documentation

> A minimal JSX UI library that uses JavaScript **generator functions** as components.
> State lives in local variables managed by hooks. The entire core is ~100 lines.

---

## Table of Contents

1. [Core concepts](#core-concepts)
2. [Component model](#component-model)
3. [JSX configuration](#jsx-configuration)
4. [Rendering](#rendering)
5. [Hooks](#hooks)
   - [useState](#usestate)
   - [useEffect](#useeffect)
   - [useRef](#useref)
   - [useId](#useid)
   - [useMemo](#usememo)
   - [useResolve](#useresolve)
   - [useResolveRaw](#useresolveraw)
   - [useRender](#userender)
   - [useResume](#useresume)
   - [useUIPatch](#useuipatch)
   - [usePatchContext](#usepatchcontext)
6. [Context](#context)
   - [createContext](#createcontext)
   - [useContext](#usecontext)
7. [Portals](#portals)
   - [createPortal](#createportal)
8. [UI patches](#ui-patches)
   - [startUIPatch / commitUIPatch](#startuipatch--commituipatch)
9. [Special props](#special-props)
10. [Events](#events)
11. [Design decisions](#design-decisions)

---

## Core concepts

yract components are **generator functions**. Instead of returning JSX on every call (like React), a component:

- Calls hooks with `yield*` to read/write persistent state
- **Returns** JSX for the current render at the end of the function body

Because the function body re-runs from the top on every render, local variables always reflect the latest state — there are no stale-closure problems.

```tsx
function* Counter(_props: object) {
  const [count, setCount] = yield* useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Clicked {count} times</button>;
}
```

---

## Component model

### Components

```ts
function* MyComponent(props: MyProps): Generator<unknown, Child, unknown> {
  // yield* hooks ...
  return <div />;   // return JSX
}
```

- Must be a `function*` (generator function)
- Hooks are called with `yield*`
- JSX is produced by `return`, not `yield`
- The generator body re-runs from the top on every re-render; hook state persists across runs

### Fragments

```tsx
function* List() {
  return (
    <>
      <li>One</li>
      <li>Two</li>
    </>
  );
}
```

`<>...</>` (Fragment) children are flattened into the parent during reconciliation.

---

## JSX configuration

### Classic transform

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "createElement",
    "jsxFragmentFactory": "Fragment"
  }
}
```

```tsx
import { createElement, Fragment } from 'yract';
```

### Automatic transform

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "yract"
  }
}
```

No manual imports needed for JSX.

---

## Rendering

### `createRoot(container)`

Creates a root for rendering a component tree into a DOM element. This is the recommended way to bootstrap your application. The root sets `$patch="default"` as the starting context for the entire tree, so every component can always rely on `$patch` being defined.

```ts
import { createRoot } from 'yract';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

| Parameter   | Type      | Description                    |
| ----------- | --------- | ------------------------------ |
| `container` | `Element` | The DOM element to render into |

**Returns:** a `Root` object with a single `render(vnode)` method.

---

### `render(vnode, container)`

Mounts a component tree into a DOM element. Call once to bootstrap the application.

```ts
import { render } from 'yract';

render(<App />, document.getElementById('root')!);
```

| Parameter   | Type      | Description                    |
| ----------- | --------- | ------------------------------ |
| `vnode`     | `VNode`   | The root VNode to mount        |
| `container` | `Element` | The DOM element to render into |

---

## Hooks

All hooks are generator functions and must be called with `yield*` inside a component or another hook.

---

### `useState`

```ts
const [value, setValue] = yield * useState(initialValue);
```

Persistent state that survives re-renders. Calling `setValue` triggers a re-render and returns a `Promise<void>` that resolves after the new state is committed to the DOM.

| Parameter      | Type             | Description                            |
| -------------- | ---------------- | -------------------------------------- |
| `initialValue` | `T \| (() => T)` | Initial value or a lazy initialiser fn |

**Returns** `[T, (value: T \| ((prev: T) => T)) => Promise<void>]`

The setter is safe to call during an active render (e.g. from inside a `useMemo` factory). When called during rendering the current render is cancelled and a single follow-up render runs with the accumulated latest state. The returned `Promise<void>` resolves after that committed render, so you can `await setValue(x)` inside an async `useMemo` factory to continue only once the DOM reflects the new value.

```tsx
function* Counter() {
  const [count, setCount] = yield* useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// Lazy initialiser — called only on first render:
const [data, setData] = yield * useState(() => expensiveCompute());

// Functional updater — receives previous state:
setCount((prev) => prev + 1);

// Await inside an async useMemo factory:
yield *
  useMemo(async () => {
    if (name !== name.toUpperCase()) {
      await setName(name.toUpperCase()); // resolves after DOM commit
      console.log('name is now uppercase in the DOM');
    }
  }, [name]);
```

> **Note:** Like React, any function passed as `initialValue` or to the setter is treated as a lazy initialiser / updater. To store a function as state, wrap it: `useState(() => myFn)`.
>
> **Multiple setters during one render are batched:** if two `setValue` calls happen synchronously during the same render, only a single follow-up render is executed with both values applied.

---

### `useEffect`

```ts
yield * useEffect(fn, deps);
```

Runs a side-effect **after** the component's DOM has been updated. Re-runs when `deps` change. If `fn` returns a function, that function is called as cleanup before the next effect run and when the component unmounts.

`fn` receives an `AbortSignal` that is aborted just as cleanup runs (when deps change or the component unmounts). Use this signal to cancel async work without needing a separate cleanup function.

| Parameter | Type                                            | Description                                                           |
| --------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `fn`      | `(signal: AbortSignal) => (() => void) \| void` | Effect callback; receives an abort signal and may return a cleanup fn |
| `deps`    | `unknown[]`                                     | Dependency array                                                      |

```tsx
function* Timer() {
  const [tick, setTick] = yield* useState(0);

  yield* useEffect((signal) => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id); // cleanup on unmount
  }, []);

  return <p>Seconds: {tick}</p>;
}
```

```tsx
// Using the AbortSignal to cancel a fetch without a cleanup function
function* UserProfile({ id }: { id: string }) {
  const [data, setData] = yield* useState<string | null>(null);

  yield* useEffect(
    (signal) => {
      fetch(`/api/users/${id}`, { signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          if (!signal.aborted) setData(text);
        })
        .catch(() => {
          // AbortError and other errors silently ignored
        });
    },
    [id],
  );

  return <p>{data ?? 'Loading…'}</p>;
}
```

> **Note:** The effect is **not** fired while the generator is paused inside `useRender`. It fires once the generator has returned its final JSX and the DOM is in place.

---

### `useRef`

```ts
const ref = yield * useRef(initialValue);
```

Returns a stable `{ current }` object that persists across re-renders. Mutating `.current` does **not** trigger a re-render.

| Parameter      | Type | Description   |
| -------------- | ---- | ------------- |
| `initialValue` | `T`  | Initial value |

**Returns** `RefObject<T>` — `{ current: T }`

```tsx
function* StopWatch() {
  const startTime = yield* useRef<number | null>(null);
  const [elapsed, setElapsed] = yield* useState(0);

  return (
    <button
      onClick={() => {
        startTime.current = Date.now();
        setElapsed(0);
      }}
    >
      Start
    </button>
  );
}
```

---

### `useId`

```ts
const id = yield * useId();
```

Returns a stable, globally unique string ID. The same component instance always gets the same ID across re-renders.

**Returns** `string` — e.g. `:r0:`, `:r1:`, …

```tsx
function* LabelledInput() {
  const id = yield* useId();
  return (
    <>
      <label htmlFor={id}>Name</label>
      <input id={id} />
    </>
  );
}
```

---

### `useMemo`

```ts
const result = yield * useMemo(fn, deps);
```

Memoises a computed value. Re-computes only when `deps` change. The dependency values are forwarded as arguments to `fn`.

| Parameter | Type                   | Description      |
| --------- | ---------------------- | ---------------- |
| `fn`      | `(...args: Deps) => T` | Factory function |
| `deps`    | `[...Deps]`            | Dependency array |

**Returns** `T`

```tsx
function* Expensive({ a, b }: { a: number; b: number }) {
  const result = yield* useMemo((a, b) => heavyCalc(a, b), [a, b]);
  return <div>{result}</div>;
}

// Empty deps — computed once per component instance:
const value = yield * useMemo(() => computeOnce(), []);
```

---

### `useResolve`

```ts
const data = yield * useResolve({ fn, loading, error }, deps);
```

Async data hook that **pauses rendering** while a promise is pending. Shows `loading` until the promise resolves, then returns the data. Shows `error` indefinitely if the promise rejects.

The `fn` callback receives an `AbortSignal` that is aborted when `deps` change or the component unmounts — pass it to `fetch` or other cancellable APIs.

| Parameter         | Type                                  | Description                                 |
| ----------------- | ------------------------------------- | ------------------------------------------- |
| `options.fn`      | `(signal: AbortSignal) => Promise<T>` | Promise factory; called when deps change    |
| `options.loading` | `Renderable`                          | Shown while pending (VNode or component fn) |
| `options.error`   | `Renderable`                          | Shown on rejection (VNode or component fn)  |
| `deps`            | `unknown[]`                           | Re-runs `fn` when any value changes         |

**Returns** `T` — the resolved value

```tsx
function* UserProfile({ userId }: { userId: number }) {
  const user = yield* useResolve(
    {
      fn: (signal) => fetch(`/api/users/${userId}`, { signal }).then((r) => r.json()),
      loading: <Spinner />,
      error: <ErrorMessage />,
    },
    [userId],
  );
  return <div>{user.name}</div>;
}
```

> **Pass `[]`** to run the promise exactly once per component instance.

---

### `useResolveRaw`

```ts
const { data, loading, error } = yield * useResolveRaw<T, E>(promise);
```

Low-level async hook. Does **not** pause rendering — returns the current state immediately and triggers a re-render when the promise settles. The component controls how each state is rendered.

| Parameter | Type         | Description          |
| --------- | ------------ | -------------------- |
| `promise` | `Promise<T>` | The promise to track |

**Returns** `ResolveRawResult<T, E>` — a discriminated union:

```ts
| { data: T;         loading: false; error: undefined }
| { data: undefined; loading: true;  error: undefined }
| { data: undefined; loading: false; error: E }
```

```tsx
function* PostViewer({ postId }: { postId: number }) {
  const promise = yield* useMemo(() => fetchPost(postId), [postId]);
  const { data, loading, error } = yield* useResolveRaw<Post, Error>(promise);

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <article>{data.title}</article>;
}
```

---

### `useRender`

```ts
// Variant 1 — pass JSX; child calls useResume() to unblock
const value = yield* useRender<T>(child);

// Variant 2 — inline render function; resume injected as prop
const value = yield* useRender<T>(({ resume }) => <UI />, deps);
```

Pauses the generator and renders UI until `resume(value)` is called. Whatever is passed to `resume` becomes the return value of `yield* useRender(...)`.

**Variant 1** — pass a JSX child. The child component obtains `resume` via `yield* useResume()`.

```tsx
function* ConfirmDialog() {
  const resume = yield* useResume<boolean>();
  return (
    <div>
      <button onClick={() => resume(true)}>Yes</button>
      <button onClick={() => resume(false)}>No</button>
    </div>
  );
}

function* DeleteButton() {
  const confirmed = yield* useRender<boolean>(<ConfirmDialog />);
  if (confirmed) await deleteItem();
  return <button>Delete</button>;
}
```

**Variant 2** — inline render function with `deps`. Re-creates the render when `deps` change.

```tsx
function* Form() {
  const answer = yield* useRender<'yes' | 'no'>(
    ({ resume }) => (
      <div>
        <button onClick={() => resume('yes')}>Yes</button>
        <button onClick={() => resume('no')}>No</button>
      </div>
    ),
    [],
  );
  return <p>You chose: {answer}</p>;
}
```

---

### `useResume`

```ts
const resume = yield * useResume<T>();
```

Returns the `resume` callback injected by the nearest parent `useRender` call (Variant 1). Calling `resume(value)` unblocks the parent generator.

**Throws** if called outside a component rendered by `useRender`.

```tsx
function* Modal() {
  const resume = yield* useResume<string>();
  return <button onClick={() => resume('done')}>Close</button>;
}
```

---

### `useUIPatch`

```ts
const startPatch = yield * useUIPatch();
```

Returns a stable `startPatch` function that, when called, freezes the **calling component's subtree** — only its descendant components defer their DOM updates. Components outside the subtree (siblings, parents) continue updating normally.

**Returns** `() => () => void` — a `startPatch` function. Calling `startPatch()` begins a local patch and returns a `commit` function. Call `commit()` to atomically flush all deferred DOM updates for the frozen subtree.

```tsx
function* PageContent() {
  const startPatch = yield* useUIPatch();
  const [page, setPage] = yield* useState('home');

  const navigate = async (next: string) => {
    const commit = startPatch();
    try {
      await fetchPageData(next); // DOM stays frozen
      setPage(next);
    } finally {
      commit(); // all changes applied at once
    }
  };

  return <main>...</main>;
}
```

- The snapshot of descendant instances is taken **at `startPatch()` call time** (not at hook registration time), so it always reflects the current tree.
- Components inside the subtree that have `$patch="live"` continue to update immediately even during a local patch.
- Nesting is supported: `startPatch()` can be called while a global patch is active; `commit()` flushes the local snapshot independently.

> See also: [`startUIPatch` / `commitUIPatch`](#startuipatch--commituipatch) for a global patch that freezes the entire tree.

---

### `usePatchContext`

```ts
const batch = yield * usePatchContext();
```

Read the current `$patch` batch behaviour from the context. Returns `'live'` or `'default'`.

Works exactly like `useContext` — the component rerenders when the effective batch changes (e.g. when a parent toggles `$patch`). If the component's own `$patch` prop changes but no other props change, the component only rerenders if it consumes `usePatchContext`.

**Returns** `'live' | 'default'`

```tsx
function* StatusBar() {
  const patch = yield* usePatchContext();
  return <span>{patch === 'live' ? 'Updating live' : 'Updates deferred'}</span>;
}

// Reads 'live' when inside a $patch="live" ancestor:
function* App() {
  return (
    <div $patch="live">
      <StatusBar /> {/* patch === 'live' */}
    </div>
  );
}
```

---

## Context

Context lets you pass data through the component tree without prop-drilling.

### `createContext`

```ts
const MyCtx = createContext<T>(defaultValue);
```

Creates a context with a default value. The returned object exposes a `Provider` component.

| Parameter      | Type | Description                                |
| -------------- | ---- | ------------------------------------------ |
| `defaultValue` | `T`  | Value used when no Provider is in the tree |

**Returns** `PublicContext<T>` — `{ Provider, _defaultValue }`

```tsx
const ThemeCtx = createContext<'light' | 'dark'>('light');

function* App() {
  const [theme, setTheme] = yield* useState<'light' | 'dark'>('light');
  return (
    <ThemeCtx.Provider value={theme}>
      <Page />
    </ThemeCtx.Provider>
  );
}
```

### `useContext`

Three call signatures:

```ts
// 1. No selector — rerenders whenever the Provider value reference changes.
const value = yield * useContext(MyCtx);

// 2. Selector — rerenders only when the selected deps change; returns full value.
const { currentGroup } = yield * useContext(MyCtx, (ctx) => [ctx.currentGroup]);

// 3. Selector + transform — same rerender guard; returns transformed value.
const name =
  yield *
  useContext(
    MyCtx,
    (ctx) => [ctx.name] as [string],
    (n) => n.toUpperCase(),
  );
```

**Overload 1 (no selector):** existing behavior, no breaking change.

**Overload 2 (selector):** `selector` is called on both the old and new Provider value when the value changes. If the returned dep arrays are shallowly equal (using `Object.is` per element), the component does **not** rerender. The full context value is still returned.

**Overload 3 (selector + transform):** same rerender guard as overload 2; additionally the return value of `useContext` is `transform(...selectorDeps)` rather than the raw context value.

```tsx
function* ThemedButton() {
  const theme = yield* useContext(ThemeCtx);
  return <button className={theme}>Click</button>;
}

// Suppresses rerenders when only unrelated fields change:
function* GroupHeader() {
  const group = yield* useContext(
    AppCtx,
    (c) => [c.currentGroup],
    (g) => g,
  );
  return <h2>{group.name}</h2>;
}
```

---

## Portals

Portals let you render children into a DOM node that exists outside the render root's DOM hierarchy. The portaled content participates in the normal component tree for context, events, and reconciliation — only the physical DOM placement differs.

### `createPortal`

```ts
createPortal(children, container, key?)
```

Creates a portal VNode that renders `children` into `container`.

| Parameter   | Type               | Description                                        |
| ----------- | ------------------ | -------------------------------------------------- |
| `children`  | `Child \| Child[]` | The children to render into the container          |
| `container` | `Element`          | The target DOM element (outside the render root)   |
| `key`       | `string?`          | Optional reconciliation key                        |

**Returns** `VNode` — a portal VNode (type = `Portal` symbol)

#### Basic portal

```tsx
function* App() {
  const modalRoot = document.getElementById('modal-root')!;
  return (
    <div>
      <h1>App</h1>
      {createPortal(<Modal />, modalRoot)}
    </div>
  );
}
```

#### Portal with context

Context flows through the component tree, not the DOM tree. A portaled child reads context from its logical parent:

```tsx
const ThemeCtx = createContext<'light' | 'dark'>('light');

function* ThemeReader() {
  const theme = yield* useContext(ThemeCtx);
  return <span>{theme}</span>;
}

function* App() {
  return (
    <ThemeCtx.Provider value="dark">
      {createPortal(
        <ThemeReader />,  // reads "dark" from context
        document.getElementById('portal-target')!,
      )}
    </ThemeCtx.Provider>
  );
}
```

#### Cleanup

When the portal VNode is removed from the tree (e.g. via `$shown` or conditional rendering), the portaled children are unmounted from the container and all cleanup functions (effects, abort signals) run as usual.

```tsx
function* App() {
  const [showModal, setShowModal] = yield* useState(false);
  return (
    <>
      <button onClick={() => setShowModal((v) => !v)}>Toggle</button>
      {showModal
        ? createPortal(<Modal />, document.getElementById('modal-root')!)
        : null}
    </>
  );
}
```

> **Notes:**
> - A comment node placeholder is inserted in the original DOM position for reconciliation tracking.
> - Event delegation works inside portals — `onClick` and other delegated events fire normally.
> - `$patch`, `$deferred`, and `$shown` props work on portal children as expected.

---

## UI patches

UI patches let you freeze DOM updates while async work runs, then apply all changes atomically. Components still execute their generators, process hooks, and update internal state during a patch — only the final DOM write is deferred.

### `startUIPatch` / `commitUIPatch`

```ts
startUIPatch(): void
commitUIPatch(): void
```

Global patch that freezes the **entire component tree**. Any code (event handlers, async functions, middleware) can call these — no hook needed.

Calls are reference-counted: nested `startUIPatch()` calls require a matching number of `commitUIPatch()` calls before the DOM is flushed.

```tsx
import { startUIPatch, commitUIPatch } from 'yract';

async function navigate(next: string) {
  startUIPatch();
  try {
    const data = await fetchPageData(next); // DOM stays frozen
    setPageData(data);
    setPage(next);
  } finally {
    commitUIPatch(); // all changes applied at once
  }
}
```

Components with `$patch="live"` update immediately even during a global patch.

> See also: [`useUIPatch`](#useuipatch) for a local patch scoped to a specific component's subtree.

---

## Special props

### `$shown`

```tsx
<Component $shown={boolean} />
<div $shown={boolean} />
```

Conditionally mounts/unmounts any element or component. When `$shown={false}` the node is replaced with an empty text node (unmounted). When it returns to `true` the component is remounted fresh.

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

> Unlike a conditional `{open && <Modal />}`, `$shown` keeps the JSX position stable in the tree, which avoids reconciler position-shift issues.

### `$deps`

```tsx
<Component $deps={[relevantValue]} otherProp={data} />
<div $deps={[relevantValue]} className={cls} />
```

Replaces the default shallow-equal props check with a dependency-array comparison — the same `depsChanged()` mechanism used by hooks. The component or element only rerenders/updates when the deps change.

Useful when a parent passes new object references on every render but the component only cares about a subset of values.

| Parameter | Type         | Description                                     |
| --------- | ------------ | ----------------------------------------------- |
| `$deps`   | `unknown[]`  | Dependency array compared via shallow `Object.is` |

```tsx
function* Parent() {
  const [relevant, setRelevant] = yield* useState(0);
  const [irrelevant, setIrrelevant] = yield* useState(0);

  // ExpensiveChild only rerenders when `relevant` changes,
  // even though `data` is a new object reference every render.
  return (
    <ExpensiveChild
      data={{ relevant, irrelevant }}
      $deps={[relevant]}
    />
  );
}
```

**For components:** when `$deps` is present and unchanged, the component's generator body is not re-executed. Context changes still trigger a rerender regardless of `$deps`.

**For HTML elements:** when `$deps` is present and unchanged, the entire subtree is frozen — prop diffing (`updateProps`) and child reconciliation are both skipped.

`$deps` is never set as a DOM attribute and is not visible in the component's props object.

### `$patch`

```tsx
<Component $patch="live" />
<div $patch="live">...</div>
```

Controls DOM update behaviour during a [UI patch](#ui-patches). Inherited recursively by all children unless overridden deeper in the tree.

| Value       | Behaviour                                                                               |
| ----------- | --------------------------------------------------------------------------------------- |
| `'default'` | DOM write deferred during any active patch (global or local). This is the root default. |
| `'live'`    | Component and its subtree always update immediately, even during a patch.               |

```tsx
function* App() {
  const startPatch = yield* useUIPatch();
  return (
    <div>
      {/* continues ticking during any patch */}
      <Header $patch="live" />
      {/* frozen while patch is active */}
      <PageContent />
    </div>
  );
}
```

`$patch` is never set as a DOM attribute — it is a renderer-only instruction.

### `$deferred`

```tsx
<Component $deferred={true} />
<div $deferred={true}>...</div>
```

Marks a subtree as lower priority for the [cooperative scheduler](./scheduler.md). Components inside a `$deferred` boundary are rendered after higher-priority components complete.

Each `$deferred={true}` increments the priority level by 1. Priority 0 (default) is the highest urgency. The scheduler processes levels in ascending order, committing DOM atomically per level.

```tsx
function* App() {
  return (
    <div>
      <Header /> {/* priority 0 — renders first */}
      <HeavyList $deferred={true} /> {/* priority 1 — renders after */}
    </div>
  );
}
```

`$deferred` is stripped from component props — the component never sees it. During the initial mount, priority levels are ignored and the entire tree renders in a single pass.

> See [Priority Scheduler & Batched Commits](./scheduler.md) for the full specification.

---

### `key`

```tsx
{
  items.map((item) => <Row key={item.id} item={item} />);
}
```

Stable identity hint for list items. Prevents accidental reuse of a slot from a different item when the list order changes.

### `ref`

```tsx
<input ref={myRef} />
```

Assigns the DOM element to `myRef.current` after mount. Use with `useRef`.

---

## Events

All `onXxx` props receive a `SyntheticEvent` wrapping the native DOM event.

```tsx
import type { SyntheticEvent } from 'yract';

function* TextInput() {
  const [value, setValue] = yield* useState('');
  return (
    <input value={value} onChange={(e: SyntheticEvent<InputEvent>) => setValue(e.target.value)} />
  );
}
```

`SyntheticEvent<E>` exposes `.nativeEvent: E` alongside convenience aliases (`target`, `currentTarget`, `preventDefault()`, `stopPropagation()`).

---

## HTML defaults

yract applies two opinionated defaults to prevent common HTML footguns:

| Element    | Behaviour                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `<button>` | `type` defaults to `"button"` (not `"submit"`) to prevent accidental form submission               |
| `<a>`      | `target="_blank"` without any `rel` logs a `console.warn` recommending `rel="noopener noreferrer"` |

Both can be overridden by explicitly setting the prop.

---

## Design decisions

### Generator functions as components

React components are plain functions that return the current UI. Re-renders mean re-calling the function, which requires hooks to maintain identity via call-order rules.

yract components are generator functions. The generator body **re-runs from the top** on every render, but hook state is persisted in the renderer (keyed by call order), so state is never lost between renders. This gives:

- **No stale closures** — every render sees fresh variables
- **Linear control flow** — `yield*` hooks read like synchronous calls
- **Pausable execution** — `useRender` and `useResolve` can pause the generator mid-body

### Hook descriptor protocol

Hooks do not access module-level variables. Instead, each hook `yield`s a **descriptor object** (`{ type: Symbol, ...payload }`). The renderer intercepts it, processes the state, and sends the result back via `gen.next(result)`. This makes hooks:

- **Pure generators** — no hidden side-effects inside the hook itself
- **Testable in isolation** — a hook is just a generator that yields objects
- **Renderer-agnostic** — the same hook can work in different renderers

```
component body
  └─ yield* useState(0)
       └─ yield { type: USE_STATE, initialValue: 0 }
            ↕  renderer intercepts, reads/writes hookStates[i], sends back [value, setter]
       └─ return [value, setter]  ← back in component body
```

### Reconciliation

The renderer tracks component instances in a `GenInstance` stored in a `WeakMap` keyed by the host span. On re-render:

1. A fresh generator is created from the component function
2. `runHooks` drives the descriptor loop, rebuilding derived state
3. `reconcileSlots` diffs the new VNode tree against the previous one:
   - **Same type, same props** → no DOM change (memoisation)
   - **Same type, changed props** → in-place DOM update
   - **Different type** → unmount old, mount new

### Context implementation

Context values are stored in an immutable `Map<Context, value>` that is set as a module-level variable before each generator run and restored afterwards. Providers create a new map (shallow copy + one entry updated) for their subtree. Components capture the map at mount time (`capturedCtx`) and use it on subsequent re-renders.

### Async rendering

`useResolve` (and the lower-level `useResolveRaw`) handle async data by storing promise state in `hookStates`. When a promise settles, it calls `rerender()` which re-runs the component body from the top — the hook then returns the settled value. A stale-promise guard (`hookStates[i] === state`) prevents resolved promises from updating the DOM after the component has moved on.

### AbortSignal lifecycle

`useResolve`'s `fn` receives an `AbortSignal` that is automatically aborted when:

- The dependency array changes (a new fetch starts)
- The component unmounts

Abort cleanup is registered via `cleanupFns[hookIndex]` on the `GenInstance`. `unmountSlot()` recursively walks the slot tree and calls all cleanup functions when a component is removed.

### Effect scheduling

`useEffect` queues its callback in `pendingEffects[]` during `runHooks`. After `reconcileSlots` (DOM updated), `flushEffects(instance)` is called. It runs each pending effect and stores the returned cleanup in `hookStates`. The guard `instance.gen === null` ensures effects only fire when the generator has fully returned its JSX — effects are deferred if the generator is still paused (e.g. inside `useRender`).

### Unmount and cleanup

When `reconcileSlots` replaces or removes a slot, it calls `unmountSlot(slot)` which:

1. Recursively unmounts all `childSlots`
2. For components, recursively unmounts `genInstance.slots`
3. Calls all `cleanupFns` entries on the `GenInstance`

This covers `useEffect` cleanup, `useResolve` abort controllers, and any future hooks that register cleanup.

### Priority scheduling

yract includes a priority-aware cooperative scheduler. Components marked with `$deferred={true}` render at lower priority, allowing critical UI to update first. The scheduler batches DOM operations per priority level and commits them atomically, preventing partial visual updates. Higher-priority work preempts lower-priority work at yield boundaries.

See [Priority Scheduler & Batched Commits](./scheduler.md) for the full specification.
