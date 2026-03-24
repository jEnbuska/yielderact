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
 * Stored on each `ComponentInstance.renderCtx` so that closures and hook
 * handlers can reach it without global lookups. The context map is
 * threaded through the generator driver, not stored here.
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
 * Slots form a parallel tree that the reconciler uses to diff old output
 * against new VNodes.
 */
export interface Slot {
  /**
   * The VNode type that produced this slot.
   * - A function reference for components.
   * - A tag string (`'div'`, `'span'`, …) for HTML elements.
   * - `'text'` for string/number primitives.
   * - `'empty'` for null/false/hidden (`$shown=false`) placeholders.
   *
   * Used by `reconcileOneGen` to detect same-type matches (reuse) vs type changes (replace).
   */
  type: VNode["type"] | "text" | "empty";

  /**
   * The real DOM node for this position.
   * - `Text` node for `'text'` and `'empty'` slots.
   * - `HTMLElement` for HTML element slots.
   * - End-marker `Comment` node for component slots.
   *
   * Inserted into / removed from the parent element by `reconcileSlots`.
   */
  node: Node;

  /**
   * The props object at last render.
   *
   * Used by `reconcileOneGen` for shallow-equality memoization: if the new
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
 * Created by `mountComponent`, referenced by `Slot.componentInstance`.
 * Survives across re-renders so hook state persists.
 * Destroyed by `unmountSlot` which calls all `cleanupFns`.
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
   * **Read by:** lifecycle closures, hook handlers, the scheduler, and
   * `unmountSlot`.
   */
  renderCtx: RenderContext;

  /**
   * The component function that produced this instance.
   * Called by `executeRerender` to create a fresh generator on each render:
   *   `const gen = instance.component(instance.props, rerender);`
   */
  component: Component;

  /**
   * The active (paused) generator, or `undefined` if the generator has returned.
   *
   * Present when the generator yielded a real VNode (e.g. `useResolve`
   * showing a loading spinner). `resumeInstance` calls `gen.next()` to
   * continue. Absent when the generator returned its final JSX.
   *
   * Set by `runHooks` and `resumeGenerator`. Read by `resumeInstance`
   * and `flushEffects` (effects only fire when `gen` is undefined).
   */
  gen?: ComponentGenerator<Child>;

  /**
   * The component's current props.
   *
   * Written by the reconciler (on prop changes) and read by `executeRerender`
   * (to create the generator) and `commitOrDefer` (for `shouldDefer` checks).
   */
  props: InternalProps;

  /**
   * Comment node marker placed after this component's output in the parent DOM.
   *
   * 1. Stable slot reference stored as `slot.node`.
   * 2. Insertion anchor for `reconcileSlotsGen`.
   *
   * `endMarker.parentNode` is used to find the parent element for reconciliation.
   */
  endMarker: Comment;

  /**
   * Snapshot of the context map from the component's parent, representing
   * inherited batch behaviour and ancestor Provider values.
   *
   * Does NOT include the component's own `$patch` prop -- that is applied
   * dynamically via `effectiveCtxMap`. Updated by the reconciler and
   * `propagateContextUpdate`.
   */
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>;

  /**
   * Set of contexts consumed via `useContext` during the last render pass.
   *
   * Written by `processOneDescriptor`, cleared at the start of each render
   * cycle. Read by the reconciler and `propagateContextUpdate` to determine
   * whether a context change requires a rerender.
   */
  consumedContexts: Set<Context<unknown>>;

  /** Contexts provided via `useSetContext` during the last render. */
  providedContexts: Set<Context<unknown>>;

  /**
   * Reconciled Slot tree for this component's last rendered output.
   *
   * Written by `executeRerenderGen` (via `reconcileSlotsGen`) and `resumeInstance`.
   * Read by the reconciler, `collectDescendants`, and `propagateContextUpdate`.
   */
  slots: Slot[];

  /**
   * Persistent per-hook storage array. Index `i` corresponds to the `i`-th
   * hook descriptor yielded during the component body. Survives across
   * re-renders.
   */
  hookStates: HookState[];

  /**
   * Per-hook cleanup functions, parallel to `hookStates`.
   *
   * Slot `i` holds a cleanup function if hook `i` needs teardown logic
   * (e.g. `useEffect` abort + cleanup, `useResolve` abort).
   * Called by `unmountSlot` on removal and `processOneDescriptor` on
   * deps change.
   */
  cleanupFns: ((() => void) | undefined)[];

  /**
   * Effects queued during the current render pass by `useEffect` descriptors.
   *
   * Cleared at the start of each render cycle and flushed by `flushEffects`
   * after reconciliation (only when `gen` is undefined).
   */
  pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
    controller: AbortController;
  }>;

  /**
   * The VNode produced by the last render that hasn't been committed to the
   * DOM yet. Set when inside an active UI patch and `shouldDefer` is true.
   * Cleared by `_flushPendingVNodes` on commit or by `commitOrDefer` on
   * immediate commit.
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
   * True while the component's generator body is executing synchronously.
   *
   * Guards against recursive re-renders: `rerenderInstance` sets
   * `pendingRerender` instead of re-entering when this is true.
   */
  isRendering: boolean;

  /**
   * True when at least one rerender was requested while `isRendering` was true.
   *
   * `runHooks` exits early with `cancelled: true` when this is set,
   * and `runComponentRender` retries with the accumulated latest state.
   */
  pendingRerender: boolean;

  /**
   * Promise resolver callbacks for `setState` calls queued during an
   * active render. Drained after a successful commit so `await setState()`
   * resumes.
   */
  renderResolvers: Array<() => void>;

  /**
   * Priority level captured from `PriorityContext` at mount time.
   *
   * 0 = default (highest). Each `$deferred` ancestor adds 1.
   * Used by the scheduler for priority ordering.
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
   * Resume a paused generator. Bound closure over `resumeInstance`.
   * @internal
   */
  _resume: () => void;

  /**
   * Execute a rerender directly, bypassing scheduling. Called by the
   * priority scheduler.
   * @internal
   */
  _executeRerender: () => Promise<void>;

  /**
   * Triggers a re-render. Bound closure over `rerenderInstance`.
   *
   * Called by useState setters, the reconciler (on prop/context changes),
   * and `propagateContextUpdate`.
   */
  rerender: () => Promise<void>;
}
