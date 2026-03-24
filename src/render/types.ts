import type { Context, UseContextState } from "../context";
import type {
  $USE_EFFECT,
  $USE_ID,
  $USE_MEMO,
  $USE_REF,
  $USE_RESOLVE,
  $USE_RESOLVE_RAW,
  $USE_STATE,
  $USE_UI_PATCH,
} from "../hooks/descriptors";
import type { ComponentGenerator, DependencyList } from "../hooks/types";
import type { UseRenderState } from "../hooks/useRender";
import type { Child, Component, InternalProps, VNode } from "../jsx";
import type { DelegationRoot } from "./delegation";

// ── Render context ─────────────────────────────────────────────────────────
//
// Per-root mutable state. Each `createRoot()` (or `render()`) creates its
// own `RenderContext`. During rendering the "active" context is set so that
// all internal modules can read/write the correct root's state.

/**
 * Per-root render state.
 *
 * Replaces the previous module-level singletons (`renderState`,
 * `_ops`, scheduler variables). Stored on each `ComponentInstance.renderCtx` so
 * that closures and hook handlers can reach it without global lookups.
 * The context map (`ctxMap`) is threaded as a parameter, not stored here.
 *
 * **Created by:** `createRenderContext()` in `state.ts`, called from
 * `render()` and `createRoot()` in `index.ts`.
 */
export interface RenderContext {
  // ── From state.ts (persistent per-root) ──
  patchDepth: number;
  dirtyInstances: Set<ComponentInstance>;
  isInitialMount: boolean;

  // ── From state.ts (rendering-phase temporary) ──
  liveOnlyMode: boolean;
  renderingPriority?: number;

  // ── From patch-queue.ts ──
  ops?: (() => void)[];

  // ── From scheduler.ts ──
  pendingUpdates: Map<number, Set<ComponentInstance>>;
  isProcessing: boolean;
  activePriority?: number;
  syncMode: boolean;

  // ── From delegation.ts ──
  /**
   * The delegation root for this render context, created by `render()` /
   * `createRoot()` and used by `applyProps` / `updateProps` to register
   * handlers and lazily attach root listeners.
   */
  delegationRoot?: DelegationRoot;
}

// ── Hook state discriminated union ──────────────────────────────────────────
//
// Each hook stores a tagged object in `ComponentInstance.hookStates`. The `kind`
// discriminant allows type-safe narrowing without `as` casts, especially in
// cross-cutting code like `flushEffects` and `_hasStableSelectors`.

/** Persistent state for a `useState` hook. */
export interface StateHookState {
  kind: typeof $USE_STATE;
  value: unknown;
}

/** Persistent state for a `useRef` hook. Holds the mutable ref object. */
export interface RefHookState {
  kind: typeof $USE_REF;
  current: unknown;
}

/** Persistent state for a `useId` hook. Holds the stable unique ID string. */
export interface IdHookState {
  kind: typeof $USE_ID;
  id: string;
}

/** Persistent state for a `useMemo` hook. */
export interface MemoHookState {
  kind: typeof $USE_MEMO;
  value: unknown;
  deps: DependencyList;
}

/** Persistent state for a `useEffect` hook. */
export interface EffectHookState {
  kind: typeof $USE_EFFECT;
  deps: DependencyList;
  cleanup?: () => void;
  controller: AbortController;
}

/** Persistent state for a `useResolveRaw` hook. */
export type ResolveRawHookState =
  | { kind: typeof $USE_RESOLVE_RAW; promise: Promise<unknown>; status: "pending" }
  | { kind: typeof $USE_RESOLVE_RAW; promise: Promise<unknown>; status: "resolved"; data: unknown }
  | {
      kind: typeof $USE_RESOLVE_RAW;
      promise: Promise<unknown>;
      status: "rejected";
      error: unknown;
    };

/** Persistent state for a `useResolve` hook. */
export interface ResolveHookState {
  kind: typeof $USE_RESOLVE;
  deps: DependencyList;
  promise: Promise<unknown>;
  controller: AbortController;
}

/** Persistent state for a `useUIPatch` hook. */
export interface UIPatchHookState {
  kind: typeof $USE_UI_PATCH;
  startPatch: () => () => void;
}

/**
 * Discriminated union of all possible hook state values.
 *
 * Each variant is tagged with a `kind` field that allows type-safe narrowing
 * when iterating `ComponentInstance.hookStates` (e.g. in `flushEffects` or
 * `_hasStableSelectors`).
 */
export type HookState =
  | StateHookState
  | RefHookState
  | IdHookState
  | MemoHookState
  | EffectHookState
  | UseContextState
  | ResolveRawHookState
  | ResolveHookState
  | UseRenderState<unknown>
  | UIPatchHookState;

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
   * - A function reference for components.
   * - A tag string (`'div'`, `'span'`, …) for HTML elements.
   * - `'text'` for string/number primitives.
   * - `'empty'` for null/false/hidden (`$shown=false`) placeholders.
   *
   * Used by `reconcileOne` to detect same-type matches (reuse) vs type changes (replace).
   */
  type: VNode["type"] | "text" | "empty";

  /**
   * The real DOM node for this position.
   * - `Text` node for `'text'` and `'empty'` slots.
   * - `HTMLElement` for HTML element slots.
   * - `<span style="display:contents">` host for component and Provider slots.
   * - The rendered DOM node directly for non-generator slots (text, empty).
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
  props: InternalProps;

  /**
   * Child slots for HTML elements and context Providers.
   *
   * For HTML element slots this contains one Slot per direct child node.
   * For Provider slots it holds the Provider's rendered children.
   * For component slots this is always `[]` — child
   * tracking lives inside `componentInstance.slots` instead.
   *
   * Recursed into by `reconcileSlots`, `unmountSlot`, and `propagateContextUpdate`.
   */
  childSlots: Slot[];

  /**
   * The running instance, present only for component slots. Absent for
   * all other slot types (HTML elements, text, empty, Providers).
   *
   * Lets the reconciler call `inst.rerender()` when props or context change,
   * read `inst.consumedContexts` for selective context updates, and access
   * `inst.slots` for subtree walks.
   */
  componentInstance?: ComponentInstance;

  /** Set only on Portal slots — the target DOM container. */
  portalContainer?: Element;

  /** Set only on Portal slots — the endMarker Comment inside the portal container. */
  portalEndMarker?: Comment;

  /** Set only on Portal slots — the DelegationRoot for the portal container. */
  portalDelegationRoot?: DelegationRoot;
}

/**
 * Persistent state for one mounted component instance.
 *
 * **Created by:** `mountComponent` in `mount.ts` — once per
 * component mount. Referenced by the component's `Slot.componentInstance` (keyed by host
 * element) and referenced by the component's `Slot.componentInstance`.
 *
 * **Survives across re-renders** — props, capturedCtx, and hookStates are
 * mutated in place so that useState values, useRef handles, and useEffect
 * cleanup functions persist.
 *
 * **Destroyed by:** `unmountSlot` in `hooks-runtime.ts` — calls all
 * `cleanupFns`, removes from `renderCtx.dirtyInstances`.
 */
export interface ComponentInstance {
  /**
   * The per-root render context this instance belongs to.
   *
   * All rendering state (patch depth, dirty instances, context map,
   * scheduler queues, etc.) lives here instead of in module-level globals.
   *
   * **Set by:** `mountComponent` — from the active render context
   * at the time the component is first mounted.
   * **Read by:** closures (`rerender`, `executeRerender`, `resume`), hook
   * handlers, the scheduler, and `unmountSlot`.
   */
  renderCtx: RenderContext;

  /**
   * The component function that produced this instance.
   * Called by `executeRerender` to create a fresh generator on each render:
   *   `const gen = instance.component(instance.props, rerender);`
   */
  component: Component;

  /**
   * The active (paused) generator, or `null` if the generator has returned.
   *
   * - **Present:** the generator yielded a real VNode (e.g. `useResolve`
   *   showing a loading spinner). `resume()` calls `gen.next()` to continue.
   * - **Absent:** the generator returned its final JSX. `executeRerender`
   *   creates a fresh generator on the next render cycle.
   *
   * Set by `runHooks` (after processing hooks) and `resume` (after gen.next).
   * Read by `resume` (to check if resumable) and `flushEffects` (effects
   * only fire when `gen === null`, i.e. the component is not mid-interaction).
   */
  gen?: ComponentGenerator<Child>;

  /**
   * The component's current props.
   *
   * **Written by:**
   * - `reconcileOne` when parent passes new props (same type, changed props).
   * - `reconcileOne`'s $patch-only path (forwards `$patch` without rerender).
   * - The live-only skip path (forwards `$patch` for shouldDefer).
   *
   * **Read by:**
   * - `executeRerender` — passed to `instance.component(instance.props, …)`.
   * - `resume` / `executeRerender` — reads `props['$patch']` to compute
   *   the effective batch for `shouldDefer`.
   */
  props: InternalProps;

  /**
   * Comment node marker placed after this component's output in the parent DOM.
   *
   * Serves two purposes:
   * 1. **Stable slot reference** — stored as `slot.node` in the parent's Slot
   *    array so the reconciler can locate and replace/remove this component.
   * 2. **Insertion anchor** — passed as `beforeAnchor` to `reconcileSlots` so
   *    that the component's output nodes are inserted before this marker
   *    (and thus stay within the component's region of the parent DOM).
   *
   * Created by `mountComponent`. Used by `executeRerender`, `resume`,
   * and `_flushPendingVNodes` via `endMarker.parentNode` to find the actual
   * parent element for reconciliation.
   */
  endMarker: Comment;

  /**
   * Snapshot of the context map from the component's **parent**,
   * representing the *inherited* batch and any ancestor Provider values.
   *
   * **Does NOT include the component's own `$patch` prop** — that is applied
   * dynamically in `executeRerender` via `_withBatch(capturedCtx, ownPatch)`.
   * This separation is critical: context change detection compares inherited
   * contexts only, while `usePatchContext` consumers see the effective
   * (inherited + own $patch) batch during their render.
   *
   * **Written by:**
   * - `mountComponent` — set to the parent `ctxMap` parameter at mount time.
   * - `reconcileOne` — synced to current inherited batch via `_withBatch`.
   * - `propagateContextUpdate` — updated when an ancestor Provider value changes.
   *
   * **Read by:**
   * - `executeRerender` / `resume` — used to compute the effective `ctxMap`
   *   before running the generator body, so hooks see the correct context values.
   * - `reconcileOne` — compared against the parent `ctxMap` to detect context changes.
   * - `_instanceBatch(capturedCtx)` — reads the inherited `$patch` batch.
   */
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>;

  /**
   * Set of contexts consumed via `useContext` during the last render pass.
   *
   * **Written by:** `processOneDescriptor($USE_CONTEXT)` — calls
   *   `instance.consumedContexts.add(ctx)` for each `useContext` call.
   * **Cleared by:** `executeRerender` at the start of each render cycle
   *   so it reflects only the current render's context subscriptions.
   *
   * **Read by:**
   * - `reconcileOne` — iterates consumed contexts to detect whether the
   *   component needs a rerender due to a context value change.
   * - `reconcileOne`'s $patch-only path — checks if `BatchContext` is consumed
   *   to decide whether `usePatchContext` consumers need a rerender.
   * - `propagateContextUpdate` — checks `inst.consumedContexts.has(ctx)`.
   */
  consumedContexts: Set<Context<unknown>>;

  /** Contexts provided via `useSetContext` during the last render. */
  providedContexts: Set<Context<unknown>>;

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
   * Each entry is a tagged object from the {@link HookState} discriminated
   * union. The `kind` field allows type-safe narrowing in cross-cutting code.
   *
   * **Survives across re-renders.** Written by `processOneDescriptor`,
   * read by subsequent renders to preserve state.
   */
  hookStates: HookState[];

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
   * **Written by:** `processOneDescriptor($USE_EFFECT)` — pushes an entry
   *   when deps change.
   * **Cleared by:** `executeRerender` at the start of each render
   *   (`pendingEffects.length = 0`) and by `flushEffects` after execution.
   * **Flushed by:** `flushEffects(instance)` — called after `reconcileSlots`
   *   in `executeRerender`, `resume`, and `_flushPendingVNodes`. Only fires
   *   when `gen === null` (component is not paused mid-interaction).
   */
  pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
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
  pendingVNode?: Child;

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
   * The component's priority level, captured from `PriorityContext` at mount time.
   *
   * Priority 0 is the default (highest priority). Each ancestor with
   * `$deferred={true}` increments the priority by 1. Lower numbers are
   * processed first.
   *
   * **Written by:** `mountComponent` — set from `PriorityContext` via the ctxMap parameter.
   * **Read by:**
   * - The scheduler — to determine which priority pass the component belongs to.
   * - `rerender()` — to tag setState calls with the owner's priority when
   *   called outside of a render phase.
   */
  priority: number;

  /**
   * Hook index at which the generator last paused (yielded a non-descriptor,
   * e.g. inside `useRender`). Used by `resume()` to continue processing
   * hook descriptors from the correct index when the generator advances
   * past a `useRender` to the next hook.
   *
   * Reset to 0 by `runHooks` at the start of each full render cycle.
   */
  resumeHookIndex: number;

  /**
   * Total hook count from the first completed (done=true) generator run.
   *
   * `undefined` until the generator has fully returned at least once
   * (it may have been halted by `useRender`/`useResolve` on previous renders).
   * Once set, subsequent complete renders must yield the same count —
   * a mismatch indicates conditional hook usage.
   */
  finalHookCount?: number;

  /**
   * Execute a rerender directly, bypassing the scheduling logic.
   *
   * Called by the priority scheduler to process an instance during a
   * scheduled priority pass. Unlike `rerender()`, this does NOT check
   * `isPatchActive()` or go through `scheduleUpdate()` — it always
   * runs `executeRerender(true)` synchronously.
   *
   * **Called by:** `_processPendingUpdates` in `scheduler.ts`.
   * @internal
   */
  _executeRerender: () => Promise<void>;

  /**
   * Triggers a full re-render of this component from the top of its
   * generator body.
   *
   * **Called by:**
   * - `useState` setters (via `processOneDescriptor` → `rerender()`).
   * - `reconcileOne` — when parent passes new props to a component.
   * - `reconcileOne` — when a consumed context value changed.
   * - `propagateContextUpdate` — when an ancestor Provider value changes
   *   and this instance consumes the affected context.
   *
   * **Implementation:** defined as a closure in `mountComponent`
   * that calls `executeRerender(true)` if not currently rendering, or sets
   * `pendingRerender = true` if a render is already in progress.
   */
  rerender: () => void;
}
