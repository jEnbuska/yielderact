/**
 * mount.ts — Initial DOM construction and component lifecycle.
 *
 * This module handles:
 * 1. **Building** DOM nodes from VNode trees (`buildNode`).
 * 2. **Mounting** components (`mountComponent`) — creates
 *    an end-marker Comment node, the `ComponentInstance`, and defines `resume`,
 *    `executeRerender`, and `rerender` closures that drive the component's
 *    lifecycle.
 * 3. **Mounting** context Providers (`mountContextProvider`).
 *
 * **No wrapper spans.** Components do not create wrapper `<span>` elements.
 * Instead, output nodes are placed directly in the parent DOM. Each component
 * and Provider uses an end-marker Comment node (`<!---->`) as an
 * insertion anchor and slot reference. The end-marker is always the last DOM
 * node belonging to the component within its parent.
 */

import {
  _asProviderFn,
  _getProviderCtx,
  _instanceBatch,
  _resolveCtxValue,
  _withBatch,
  BatchContext,
  type Context,
  PriorityContext,
} from "../context";
import { $USE_EFFECT } from "../hooks/descriptors";
import { type Child, type Component, Fragment, type InternalProps, Portal } from "../jsx";
import { InvalidChildError } from "./errors";
import {
  getPatchMode,
  isComponentNode,
  isShown,
  mergedProps,
  stripFrameworkDirectives,
} from "./helpers";
import { flushEffects, resumeGenerator, runHooks } from "./hooks-runtime";
import { isPatchActive } from "./patch-queue";
import { applyProps } from "./props";
import { reconcileSlots } from "./reconciler";
import { scheduleUpdate } from "./scheduler";
import {
  _requireActiveCtx,
  _setActiveCtx,
  type ContextGenerator,
  getContext,
  getContextMap,
  runWithContext,
  setContext,
} from "./state";
import type { ComponentInstance, HookState, RenderContext, Slot } from "./types";

/**
 * Build a single real DOM node from a virtual DOM node (or primitive value).
 *
 * Unlike `buildVNodeList`, this returns a single Node and does not produce
 * Slot tracking data. Used for top-level renders and Fragment children.
 *
 * **Called by:**
 * - `render()` and `createRoot().render()` in `index.ts` — top-level mount.
 * - Itself (recursively) — for Fragment children and HTML element children.
 * - `reconcileOne` in `reconciler.ts` — fallback for unrecognized VNode types.
 *
 * **Handles:**
 * 1. `null` / `undefined` / `false` → empty TextNode.
 * 2. `string` / `number` → TextNode.
 * 3. `Fragment` → `DocumentFragment` containing children.
 * 4. Component → dispatches to `mountComponent`
 *    or `mountContextProvider`.
 * 5. HTML tag string → `HTMLElement` with props and children.
 *
 * @param child - The VNode or primitive to build.
 * @returns The real DOM node. For components and Providers, returns
 *   a `DocumentFragment` containing the output nodes + endMarker.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode type dispatch with many branches
export function* buildNode(child: Child): ContextGenerator<Node> {
  if (child == null || typeof child === "boolean") {
    return document.createTextNode("");
  }
  if (typeof child === "string" || typeof child === "number") {
    return document.createTextNode(String(child));
  }
  if (!child.type) {
    throw new InvalidChildError(child);
  }
  if (child.type === Fragment) {
    const frag = document.createDocumentFragment();
    const map = yield* getContextMap();
    for (const c of child.children) {
      frag.appendChild(runWithContext(map, buildNode(c)));
    }
    return frag;
  }

  if (child.type === Portal) {
    const portalContainer = child.props["$portalContainer"] as Element;
    const map = yield* getContextMap();
    for (const c of child.children) {
      portalContainer.appendChild(runWithContext(map, buildNode(c)));
    }
    return document.createComment("portal");
  }

  if (isComponentNode(child)) {
    const component = child.type;
    const allPropsRaw = mergedProps(child);
    if (!isShown(allPropsRaw)) {
      return document.createTextNode("");
    }
    // Strip $deferred and $deps from component props; propagate $deferred via context.
    const allProps = stripFrameworkDirectives(allPropsRaw);
    if (allPropsRaw.$deferred) {
      yield* setContext(PriorityContext, (yield* getContext(PriorityContext)) + 1);
    }
    const ctxMap = (yield* getContextMap()) as ReadonlyMap<Context<unknown>, unknown>;
    const providerCtx = _getProviderCtx(component);
    if (providerCtx) {
      return mountContextProvider(component, allProps, providerCtx, ctxMap).fragment;
    }
    return mountComponent(component, allProps, ctxMap).fragment;
  }

  if (!isShown(child.props)) {
    return document.createTextNode("");
  }

  // HTML element — propagate $patch and $deferred to children via context.
  const el = document.createElement(child.type as string);
  applyProps(el, child.props);
  const elBatch = getPatchMode(child.props);
  if (elBatch !== undefined) {
    yield* setContext(BatchContext, elBatch);
  }
  if (child.props.$deferred) {
    yield* setContext(PriorityContext, (yield* getContext(PriorityContext)) + 1);
  }
  const childMap = yield* getContextMap();
  for (const c of child.children) {
    el.appendChild(runWithContext(childMap, buildNode(c)));
  }
  return el;
}

/**
 * Decide whether to commit a VNode immediately or defer it during a UI patch.
 *
 * When a global or local patch is active and the component is not `$patch="live"`,
 * the VNode is stored as `pendingVNode` and a live-only reconcile pass updates
 * only `$patch="live"` descendants. Otherwise, the VNode is committed immediately
 * via `reconcileSlots` and effects are flushed.
 *
 * **Called by:** `resume` and `executeRerender` in `mountComponent`.
 */
function commitOrDefer(
  instance: ComponentInstance,
  vnode: Child,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): void {
  const rctx = instance.renderCtx;
  const parent = instance.endMarker.parentNode as HTMLElement;
  const effectiveBatch = getPatchMode(instance.props) ?? _instanceBatch(instance.capturedCtx);
  const shouldDefer =
    (rctx.patchDepth > 0 || instance.localPatchRefCount > 0) && effectiveBatch !== "live";
  if (shouldDefer) {
    instance.pendingVNode = vnode;
    rctx.dirtyInstances.add(instance);
    const prevLiveOnly = rctx.liveOnlyMode;
    rctx.liveOnlyMode = true;
    try {
      instance.slots = reconcileSlots(parent, instance.slots, [vnode], instance.endMarker, ctxMap);
    } finally {
      rctx.liveOnlyMode = prevLiveOnly;
    }
  } else {
    instance.pendingVNode = undefined;
    instance.slots = reconcileSlots(parent, instance.slots, [vnode], instance.endMarker, ctxMap);
    flushEffects(instance);
  }
}

/**
 * Mount a component using an end-marker Comment node.
 *
 * This is the heart of the component lifecycle. It:
 * 1. Creates an end-marker Comment node (`<!---->`) that serves as the
 *    component's positional anchor in the parent DOM.
 * 2. Captures the current context map (`capturedCtx`).
 * 3. Creates the `ComponentInstance` with all mutable state arrays.
 * 4. Defines three closures (`resume`, `executeRerender`, `rerender`) that
 *    close over the instance and drive the component's lifecycle.
 * 5. Calls `executeRerender(false)` to run the initial mount.
 * 6. Returns a `DocumentFragment` containing the initial output nodes and
 *    the endMarker (the caller appends it to the parent DOM).
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a new component appears
 *   at a position where a different type was before.
 *
 * @param component - The component function.
 * @param props     - The component's initial props.
 * @returns `{ fragment, componentInstance }` — the fragment to insert into the DOM
 *   and the instance for slot tracking.
 */
export function mountComponent(
  component: Component,
  props: InternalProps,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): { fragment: DocumentFragment; componentInstance: ComponentInstance } {
  const endMarker = document.createComment("");

  /** The per-root render context, captured from the active context at mount time. */
  const rctx: RenderContext = _requireActiveCtx();

  /**
   * The context map captured at mount time, representing the **inherited**
   * context from ancestors. Does NOT include the component's own `$patch`
   * — that is applied dynamically in `executeRerender` via `_withBatch`.
   */
  const capturedCtx = ctxMap;

  /** Priority level captured from the context at mount time. */
  const priority = _resolveCtxValue(ctxMap, PriorityContext);

  /** Per-hook persistent state array. See `ComponentInstance.hookStates`. */
  const hookStates: HookState[] = [];

  /** Per-hook cleanup functions. See `ComponentInstance.cleanupFns`. */
  const cleanupFns: ((() => void) | undefined)[] = [];

  /** Queued effects for the current render pass. See `ComponentInstance.pendingEffects`. */
  const pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
    controller: AbortController;
  }> = [];

  // `instance` is assigned before any external code can observe it.
  // `resume`, `rerender`, and `executeRerender` all close over it.
  let instance: ComponentInstance;

  // Nodes produced by the initial render — set synchronously by
  // executeRerender(false) below. Pre-initialized so the return statement
  // doesn't require a non-null assertion or unsafe cast.
  let initialFragment = document.createDocumentFragment();

  /**
   * Resume a paused generator (e.g. inside `useResolve` or `useRender`).
   *
   * Called when the pending operation completes — `useResolve`'s promise
   * resolves, or `useRender`'s `resumeCallback` is invoked. Advances the
   * generator one step via `gen.next()` and reconciles the resulting VNode.
   *
   * If a UI patch is active and the component is not `$patch="live"`,
   * the DOM update is deferred: the VNode is stored as `pendingVNode` and
   * a live-only reconcile pass updates only `$patch="live"` descendants.
   *
   * **Called by:**
   * - `useRender`'s `resumeCallback` (registered in `processOneDescriptor`).
   * - `useResolve`'s promise `.then()` handler (indirectly via rerender,
   *   but `resume` is for mid-generator continuation specifically).
   */
  function resume(): void {
    if (!instance.gen) return;
    if (!instance.endMarker.parentNode) return;
    _setActiveCtx(rctx);

    // Compute effective context: inherited context + own $patch applied for children.
    const ownPatchResume = getPatchMode(instance.props);
    const effectiveCtxMap =
      ownPatchResume !== undefined
        ? _withBatch(instance.capturedCtx, ownPatchResume)
        : instance.capturedCtx;

    const { vnode } = resumeGenerator(instance, rerender, resume, effectiveCtxMap);

    commitOrDefer(instance, vnode, effectiveCtxMap);
  }

  /**
   * Run the generator body in a loop, retrying on mid-render state changes.
   *
   * This is the core render execution function, used for both the initial
   * mount (`mounted=false`) and all subsequent re-renders (`mounted=true`).
   *
   * **Loop structure:**
   * 1. Set `isRendering = true` to guard against recursive rerenders.
   * 2. Clear paused generator and pending effects.
   * 3. Clear `consumedContexts` so the new render records fresh subscriptions.
   * 4. Set the context map to `capturedCtx` (with own `$patch` applied).
   * 5. Create a fresh generator: `instance.component(instance.props, rerender)`.
   * 6. Run `runHooks(gen, …)` — processes hook descriptors, returns VNode.
   * 7. Set `isRendering = false`.
   * 8. If cancelled (mid-render setState detected) → revert effect deps, retry.
   * 9. If not cancelled → commit the VNode:
   *    - Initial mount: `buildVNodeList` → store nodes for fragment assembly.
   *    - Rerender: check `shouldDefer` → either store `pendingVNode` or
   *      `reconcileSlots` immediately, using `endMarker.parentNode` as the
   *      actual parent and `endMarker` as the insertion anchor.
   * 10. Resolve any `renderResolvers` (awaited setState promises).
   * 11. If `pendingRerender` is set → loop again for follow-up rerender.
   *
   * **Called by:**
   * - The initial mount at the bottom of `mountComponent`.
   * - `rerender()` below — for all subsequent re-renders.
   *
   * @param mounted - `false` on initial mount, `true` on rerenders. Controls
   *   whether nodes are stored for fragment assembly or reconciled in place.
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: generator lifecycle with retry, defer, and reconciliation
  function executeRerender(initiallyMounted: boolean): Promise<void> {
    let mounted = initiallyMounted;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      instance.isRendering = true;
      // Discard any paused generator; the fresh run starts from the top.
      instance.gen = undefined;
      instance.pendingEffects.length = 0;

      // Reset consumed-context tracking so the new render records a fresh set.
      instance.consumedContexts.clear();

      // Compute effective context: inherited context + own $patch for children.
      const ownPatch = getPatchMode(instance.props);
      const effectiveCtxMap =
        ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx;

      let vnode: Child;
      let cancelled = false;
      const prevRenderingPriority = rctx.renderingPriority;
      rctx.renderingPriority = instance.priority;
      try {
        const gen = instance.component(instance.props, rerender);
        const result = runHooks(gen, instance, rerender, resume, effectiveCtxMap);
        instance.gen = result.gen;
        vnode = result.vnode;
        cancelled = result.cancelled;
      } finally {
        instance.isRendering = false;
        rctx.renderingPriority = prevRenderingPriority;
      }

      if (cancelled) {
        // Revert deps for effects queued during this cancelled render so the
        // retry re-queues them (their deps in hookStates already match).
        for (const pe of instance.pendingEffects) {
          const state = instance.hookStates[pe.hookIndex];
          if (state !== undefined && state.kind === $USE_EFFECT) {
            state.deps = [];
          }
        }
        // A mid-render setState was queued — retry with the accumulated state.
        instance.pendingRerender = false;
        continue;
      }

      // ── Commit ──
      if (!mounted) {
        // Initial mount: build DOM into a DocumentFragment via reconcileSlots.
        // The endMarker is pre-appended so it serves as the insertion anchor.
        // Temporarily disable liveOnlyMode — fresh mounts always create real
        // nodes (matching the old buildVNodeList behavior which had no
        // liveOnlyMode guards).
        initialFragment = document.createDocumentFragment();
        initialFragment.appendChild(endMarker);
        const prevLiveOnly = rctx.liveOnlyMode;
        rctx.liveOnlyMode = false;
        instance.slots = reconcileSlots(initialFragment, [], [vnode], endMarker, effectiveCtxMap);
        rctx.liveOnlyMode = prevLiveOnly;
        mounted = true;
        flushEffects(instance);
      } else {
        commitOrDefer(instance, vnode, effectiveCtxMap);
      }

      // Resolve all Promise<void>s returned by setState calls that were
      // queued during this render batch.
      const resolvers = instance.renderResolvers.splice(0);
      for (const resolve of resolvers) resolve();

      // A follow-up rerender may have been requested (e.g. from an effect or
      // an async callback that fired synchronously after resolve()).
      // Guard against zombie rerenders: if the component was unmounted during
      // this render cycle (e.g. by an effect), bail out.
      if (mounted && !instance.endMarker.parentNode) {
        return Promise.resolve();
      }
      if (instance.pendingRerender) {
        instance.pendingRerender = false;
        continue;
      }

      return Promise.resolve();
    }
  }

  /**
   * Trigger a full re-render of this component from the top of its
   * generator body.
   *
   * **If a render is already in progress** (`isRendering === true`):
   * the request is queued — `pendingRerender` is set so the active
   * `runHooks` loop exits early, and a Promise is returned that resolves
   * after the next committed render.
   *
   * **Otherwise:** `executeRerender(true)` is called immediately.
   *
   * **Called by:**
   * - `useState` setters — via the setter function returned by
   *   `processOneDescriptor($USE_STATE)`.
   * - `reconcileOne` in `reconciler.ts` — when the parent passes new
   *   props, or a consumed context value changed.
   * - `propagateContextUpdate` in `hooks-runtime.ts` — when an ancestor
   *   Provider value changes and this instance consumes the context.
   * - `useResolveRaw`'s `.then()` handler — when a tracked promise settles.
   *
   * @returns A Promise that resolves after the rerender is committed.
   */
  function rerender(): Promise<void> {
    if (instance.isRendering) {
      instance.pendingRerender = true;
      return new Promise<void>((resolve) => {
        instance.renderResolvers.push(resolve);
      });
    }
    if (!instance.endMarker.parentNode) return Promise.resolve();
    _setActiveCtx(rctx);
    if (isPatchActive()) {
      // During an active patch (another component is rendering or a
      // $patch batch is in progress), execute synchronously so the DOM
      // ops are collected into the same patch queue.
      return executeRerender(true /* already mounted */);
    }
    // Outside a render phase (event handler, timer, async callback, etc.)
    // — schedule through the priority-aware scheduler.
    scheduleUpdate(instance);
    return Promise.resolve();
  }

  // ── Initial mount ──
  instance = {
    renderCtx: rctx,
    component,
    props,
    endMarker,
    capturedCtx,
    slots: [],
    hookStates,
    cleanupFns,
    pendingEffects,
    localPatchRefCount: 0,
    isRendering: false,
    pendingRerender: false,
    renderResolvers: [],
    priority,
    resumeHookIndex: 0,
    _executeRerender: () => executeRerender(true),
    rerender,
    consumedContexts: new Set(),
  };

  void executeRerender(false /* not yet mounted */);

  // initialFragment is reassigned by executeRerender(false) above (endMarker
  // included). TypeScript can't track the mutation across the closure boundary.
  return { fragment: initialFragment, componentInstance: instance };
}

/**
 * Mount a context Provider component.
 *
 * Pushes the Provider's `value` onto the context map, builds the
 * Provider's children (which see the new value), then restores the
 * previous context map.
 *
 * Returns a DocumentFragment (containing the Provider's children and
 * an endMarker Comment) and the child Slot array so that the reconciler
 * can update children in-place on subsequent renders.
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a new Provider appears at
 *   a position where a different type was before.
 *
 * @param fn          - The Provider function (created by `createContext`).
 * @param props       - The Provider's props (includes `value` and `children`).
 * @param providerCtx - The Context object this Provider supplies.
 * @returns `{ fragment, endMarker, childSlots }` — the fragment to insert
 *   into the DOM, the endMarker for slot tracking, and Slot data for children.
 */
export function mountContextProvider(
  component: Component,
  props: InternalProps,
  providerCtx: Context<unknown>,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): { fragment: DocumentFragment; endMarker: Comment; childSlots: Slot[] } {
  const newCtxMap = new Map(ctxMap);
  newCtxMap.set(providerCtx, props["value"]);

  const endMarker = document.createComment("");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(endMarker);
  let childSlots: Slot[] = [];

  const vnode = _asProviderFn(component)(props);
  if (vnode != null) {
    const activeCtx = _requireActiveCtx();
    const prevLiveOnly = activeCtx.liveOnlyMode;
    activeCtx.liveOnlyMode = false;
    childSlots = reconcileSlots(fragment, [], [vnode], endMarker, newCtxMap);
    activeCtx.liveOnlyMode = prevLiveOnly;
  }
  return { fragment, endMarker, childSlots };
}
