import { type VNode, type Child, type GeneratorComponentFn } from '../jsx';
import { type Context } from '../context';

/**
 * A **Slot** tracks one reconciled position in the rendered DOM tree.
 *
 * Every DOM child produced by the renderer has a corresponding Slot.
 * Slots form a parallel tree to the real DOM that the reconciler uses to
 * diff old output against new VNodes (see `reconcileSlots` / `reconcileOne`
 * in `reconciler.ts`).
 *
 * **Created by:** `buildVNodeList` (initial mount) and `reconcileOne` (updates).
 * **Consumed by:** `reconcileSlots` (positional diffing), `unmountSlot` (teardown),
 *   `propagateContextUpdate` (context change walks), `collectDescendants` (local-patch snapshots).
 */
export interface Slot {
  /**
   * The VNode type that produced this slot.
   * - A function reference (component) for function components.
   * - A tag string (`'div'`, `'span'`, …) for HTML elements.
   * - `'text'` for string/number primitives.
   * - `'empty'` for null/false/hidden (`$shown=false`) placeholders.
   *
   * Used by `reconcileOne` to detect same-type matches (reuse) vs type changes (replace).
   */
  type: VNode['type'] | 'text' | 'empty';

  /**
   * The real DOM node for this position.
   * - `Text` node for `'text'` and `'empty'` slots.
   * - `HTMLElement` for HTML element slots.
   * - `<span style="display:contents">` host for component slots (generator, plain, or Provider).
   *
   * Inserted into / removed from the parent element by `reconcileSlots`.
   */
  node: Node;

  /**
   * The props object at last render.
   *
   * Used by `reconcileOne` for shallow-equality memoization: if the new
   * VNode has the same type and `shallowEqual(prevSlot.props, newProps)`,
   * the component is skipped (no rerender).
   *
   * Updated in place when the reconciler commits a prop change.
   */
  props: Record<string, unknown>;

  /**
   * Child slots for HTML elements and context Providers.
   *
   * For HTML element slots this contains one Slot per direct child node.
   * For Provider slots it holds the Provider's rendered children.
   * For generator/plain component slots this is always `[]` — child
   * tracking lives inside `genInstance.slots` instead.
   *
   * Recursed into by `reconcileSlots`, `unmountSlot`, and `propagateContextUpdate`.
   */
  childSlots: Slot[];

  /**
   * The running generator instance, present only for generator-function
   * component slots. `null` for all other slot types (HTML elements,
   * text, empty, plain components, Providers).
   *
   * Lets the reconciler call `inst.rerender()` when props or context change,
   * read `inst.consumedContexts` for selective context updates, and access
   * `inst.slots` for subtree walks.
   */
  genInstance: GenInstance | null;
}

/**
 * Persistent state for one mounted generator component instance.
 *
 * **Created by:** `mountGeneratorComponent` in `mount.ts` — once per
 * component mount. Stored in `renderState.genInstanceMap` (keyed by host
 * element) and referenced by the component's `Slot.genInstance`.
 *
 * **Survives across re-renders** — props, capturedCtx, and hookStates are
 * mutated in place so that useState values, useRef handles, and useEffect
 * cleanup functions persist.
 *
 * **Destroyed by:** `unmountSlot` in `hooks-runtime.ts` — calls all
 * `cleanupFns`, removes from `renderState.dirtyInstances`.
 */
export interface GenInstance {
  /**
   * The generator-function component that produced this instance.
   * Called by `executeRerender` to create a fresh generator on each render:
   *   `const gen = instance.fn(instance.props, rerender);`
   */
  fn: GeneratorComponentFn;

  /**
   * The active (paused) generator, or `null` if the generator has returned.
   *
   * - **Non-null:** the generator yielded a real VNode (e.g. `useResolve`
   *   showing a loading spinner). `resume()` calls `gen.next()` to continue.
   * - **`null`:** the generator returned its final JSX. `executeRerender`
   *   creates a fresh generator on the next render cycle.
   *
   * Set by `runHooks` (after processing hooks) and `resume` (after gen.next).
   * Read by `resume` (to check if resumable) and `flushEffects` (effects
   * only fire when `gen === null`, i.e. the component is not mid-interaction).
   */
  gen: Generator<unknown, Child, unknown> | null;

  /**
   * The component's current props.
   *
   * **Written by:**
   * - `reconcileOne` when parent passes new props (same type, changed props).
   * - `reconcileOne`'s $patch-only path (forwards `$patch` without rerender).
   * - The live-only skip path (forwards `$patch` for shouldDefer).
   *
   * **Read by:**
   * - `executeRerender` — passed to `instance.fn(instance.props, …)`.
   * - `resume` / `executeRerender` — reads `props['$patch']` to compute
   *   the effective batch for `shouldDefer`.
   */
  props: Record<string, unknown>;

  /**
   * The `<span style="display:contents">` element that wraps this component's
   * rendered output in the real DOM.
   *
   * Created by `mountGeneratorComponent`. Used as the `parent` argument to
   * `reconcileSlots` so that child DOM nodes are inserted/removed inside it.
   * Registered in `renderState.genInstanceMap` as the key for this instance.
   */
  host: HTMLElement;

  /**
   * Snapshot of the context map (`_ctxMap`) from the component's **parent**,
   * representing the *inherited* batch and any ancestor Provider values.
   *
   * **Does NOT include the component's own `$patch` prop** — that is applied
   * dynamically in `executeRerender` via `_withBatch(capturedCtx, ownPatch)`.
   * This separation is critical: context change detection compares inherited
   * contexts only, while `usePatchContext` consumers see the effective
   * (inherited + own $patch) batch during their render.
   *
   * **Written by:**
   * - `mountGeneratorComponent` — set to `_getCtxMap()` at mount time.
   * - `reconcileOne` — synced to current inherited batch via `_withBatch`.
   * - `propagateContextUpdate` — updated when an ancestor Provider value changes.
   *
   * **Read by:**
   * - `executeRerender` / `resume` — restored as the active `_ctxMap` before
   *   running the generator body, so hooks see the correct context values.
   * - `reconcileOne` — compared against `_getCtxMap()` to detect context changes.
   * - `_instanceBatch(capturedCtx)` — reads the inherited `$patch` batch.
   */
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>;

  /**
   * Set of contexts consumed via `useContext` during the last render pass.
   *
   * **Written by:** `processOneDescriptor(USE_CONTEXT)` — calls
   *   `instance.consumedContexts.add(ctx)` for each `useContext` call.
   * **Cleared by:** `executeRerender` at the start of each render cycle
   *   so it reflects only the current render's context subscriptions.
   *
   * **Read by:**
   * - `reconcileOne` — iterates consumed contexts to detect whether the
   *   component needs a rerender due to a context value change.
   * - `reconcileOne`'s $patch-only path — checks if `_batchCtx` is consumed
   *   to decide whether `usePatchContext` consumers need a rerender.
   * - `propagateContextUpdate` — checks `inst.consumedContexts.has(ctx)`.
   */
  consumedContexts: Set<Context<unknown>>;

  /**
   * Reconciled Slot tree for this component's last rendered output.
   *
   * **Written by:** `executeRerender` (via `buildVNodeList` on mount, via
   *   `reconcileSlots` on rerender) and `resume`.
   * **Read by:** `reconcileSlots` (diffed against new VNodes),
   *   `collectDescendants` (local-patch snapshots), `propagateContextUpdate`.
   */
  slots: Slot[];

  /**
   * Persistent per-hook storage array. Index `i` corresponds to the `i`-th
   * hook descriptor yielded during the component body.
   *
   * Contents vary by hook type:
   * - `useState`: the current state value.
   * - `useRef`: `{ current: T }` ref object.
   * - `useId`: the stable `":rN:"` ID string.
   * - `useMemo`: `{ value, deps }`.
   * - `useContext`: `UseContextState` with `ctx`, `selector`, `lastDeps`, `lastResult`.
   * - `useResolveRaw`: `{ promise, status, data?, error? }`.
   * - `useResolve`: `{ deps, promise, controller }`.
   * - `useEffect`: `{ deps, cleanup, controller }`.
   * - `useRender`: `UseRenderState` with `status`, `deps`, `value`, `resumeCallback`.
   * - `useUIPatch`: the `startPatch` function.
   *
   * **Survives across re-renders.** Written by `processOneDescriptor`,
   * read by subsequent renders to preserve state.
   */
  hookStates: unknown[];

  /**
   * Per-hook cleanup functions, parallel to `hookStates`.
   *
   * Slot `i` holds a cleanup function if hook `i` needs teardown logic:
   * - `useResolve`: aborts the `AbortController`.
   * - `useEffect`: aborts the signal + calls the effect's returned cleanup.
   *
   * **Called by:**
   * - `unmountSlot` — iterates all cleanup fns when the component is removed.
   * - `processOneDescriptor` — calls previous cleanup before re-running
   *   (e.g. `useEffect` when deps change, `useResolve` when deps change).
   */
  cleanupFns: ((() => void) | undefined)[];

  /**
   * Effects queued during the current render pass by `useEffect` descriptors.
   *
   * Each entry holds the hook index, the effect function, and an `AbortController`
   * so the effect receives a signal it can check for cancellation.
   *
   * **Written by:** `processOneDescriptor(USE_EFFECT)` — pushes an entry
   *   when deps change.
   * **Cleared by:** `executeRerender` at the start of each render
   *   (`pendingEffects.length = 0`) and by `flushEffects` after execution.
   * **Flushed by:** `flushEffects(instance)` — called after `reconcileSlots`
   *   in `executeRerender`, `resume`, and `_flushPendingVNodes`. Only fires
   *   when `gen === null` (component is not paused mid-interaction).
   */
  pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | void;
    controller: AbortController;
  }>;

  /**
   * The VNode produced by the last render that hasn't been committed to
   * the DOM yet. Set when the component is inside an active UI patch
   * (global or local) and `shouldDefer` is true.
   *
   * **Written by:** `executeRerender` / `resume` when `shouldDefer` is true.
   * **Cleared by:** `_flushPendingVNodes` when the patch is committed, or
   *   by `executeRerender` when `shouldDefer` is false (immediate commit).
   * **Read by:** `_flushPendingVNodes` — skips instances with `undefined`.
   */
  pendingVNode: Child | undefined;

  /**
   * Number of active local patches (`useUIPatch`) whose snapshot includes
   * this instance.
   *
   * > 0 means this instance's DOM writes are deferred (similar to global
   * `patchDepth > 0`, but scoped to a subtree).
   *
   * **Incremented by:** `useUIPatch`'s `startPatch()` — for the root
   *   instance and all its snapshotted descendants.
   * **Decremented by:** `useUIPatch`'s `commit()` — the returned cleanup function.
   * **Read by:** `executeRerender` / `resume` — included in the
   *   `shouldDefer` check: `(patchDepth > 0 || localPatchRefCount > 0)`.
   */
  localPatchRefCount: number;

  /**
   * True while the component's generator body is executing synchronously
   * inside `executeRerender` → `runHooks`.
   *
   * Guards against recursive re-renders: if a `useState` setter fires
   * during render (e.g. `const [v, set] = yield* useState(0); set(1);`),
   * `rerender()` sees `isRendering === true` and sets `pendingRerender`
   * instead of calling `executeRerender` recursively.
   *
   * **Set to `true` by:** `executeRerender` before calling `runHooks`.
   * **Set to `false` by:** `executeRerender` in the `finally` block.
   * **Read by:** `rerender()`.
   */
  isRendering: boolean;

  /**
   * True when at least one rerender was requested while `isRendering` was true.
   *
   * When `runHooks` sees this flag set, it exits early with `cancelled: true`,
   * discarding the stale partial render. The `while(true)` loop in
   * `executeRerender` then retries with the accumulated latest state.
   *
   * **Set by:** `rerender()` when `isRendering` is true.
   * **Cleared by:** `executeRerender` before retrying and after checking
   *   for follow-up rerenders at the end of a committed render.
   * **Read by:** `runHooks` (checks after each hook descriptor) and
   *   `executeRerender` (checks after commit for follow-up rerenders).
   */
  pendingRerender: boolean;

  /**
   * Promise resolver callbacks from `setState` calls that were queued
   * during an active render (i.e. `rerender()` was called while
   * `isRendering` was true).
   *
   * `await setState(value)` returns a `Promise<void>` that resolves only
   * after the new state is committed to the DOM.
   *
   * **Pushed to by:** `rerender()` — creates a Promise and pushes its resolver.
   * **Drained by:** `executeRerender` — calls `resolve()` on each entry
   *   after a successful commit, so `await setState(…)` resumes.
   */
  renderResolvers: Array<() => void>;

  /**
   * Triggers a full re-render of this component from the top of its
   * generator body.
   *
   * **Called by:**
   * - `useState` setters (via `processOneDescriptor` → `rerender()`).
   * - `reconcileOne` — when parent passes new props to a generator component.
   * - `reconcileOne` — when a consumed context value changed.
   * - `propagateContextUpdate` — when an ancestor Provider value changes
   *   and this instance consumes the affected context.
   *
   * **Implementation:** defined as a closure in `mountGeneratorComponent`
   * that calls `executeRerender(true)` if not currently rendering, or sets
   * `pendingRerender = true` if a render is already in progress.
   */
  rerender: () => void;
}
