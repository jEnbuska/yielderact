/**
 * mount.ts — Initial DOM construction and generator component lifecycle.
 *
 * This module handles:
 * 1. **Building** DOM nodes from VNode trees (`buildNode`).
 * 2. **Mounting** generator components (`mountGeneratorComponent`) — creates
 *    an end-marker Comment node, the `GenInstance`, and defines `resume`,
 *    `executeRerender`, and `rerender` closures that drive the component's
 *    lifecycle.
 * 3. **Mounting** plain function components (`mountPlainComponent`).
 * 4. **Mounting** context Providers (`mountContextProvider`).
 *
 * **No wrapper spans.** Components do not create wrapper `<span>` elements.
 * Instead, output nodes are placed directly in the parent DOM. Each generator
 * component and Provider uses an end-marker Comment node (`<!---->`) as an
 * insertion anchor and slot reference. The end-marker is always the last DOM
 * node belonging to the component within its parent.
 */

import {
  _getCtxMap,
  _getCurrentPriority,
  _getProviderCtx,
  _instanceBatch,
  _setCtxMap,
  _withBatch,
  _withPriority,
} from "../context";
import {
  type AnyComponentFn,
  type Child,
  Fragment,
  type GeneratorComponentFn,
  type PlainComponentFn,
} from "../jsx";
import { isGeneratorFn, isShown, mergedProps, stripDeferred } from "./helpers";
import { flushEffects, runHooks } from "./hooks-runtime";
import { isPatchActive } from "./patch-queue";
import { applyProps } from "./props";
import { reconcileSlots } from "./reconciler";
import { scheduleUpdate } from "./scheduler";
import { renderState } from "./state";
import type { GenInstance, Slot } from "./types";

/**
 * Build a single real DOM node from a virtual DOM node (or primitive value).
 *
 * Unlike `buildVNodeList`, this returns a single Node and does not produce
 * Slot tracking data. Used for top-level renders and Fragment children.
 *
 * **Called by:**
 * - `render()` and `createRoot().render()` in `index.ts` — top-level mount.
 * - `mountPlainComponent` — builds the plain component's output.
 * - Itself (recursively) — for Fragment children and HTML element children.
 * - `reconcileOne` in `reconciler.ts` — fallback for unrecognized VNode types.
 *
 * **Handles:**
 * 1. `null` / `undefined` / `false` → empty TextNode.
 * 2. `string` / `number` → TextNode.
 * 3. `Fragment` → `DocumentFragment` containing children.
 * 4. Function component → dispatches to `mountGeneratorComponent`,
 *    `mountPlainComponent`, or `mountContextProvider`.
 * 5. HTML tag string → `HTMLElement` with props and children.
 *
 * @param child - The VNode or primitive to build.
 * @returns The real DOM node. For generator components and Providers, returns
 *   a `DocumentFragment` containing the output nodes + endMarker.
 */
export function buildNode(child: Child): Node {
  if (child == null || typeof child === "boolean") {
    return document.createTextNode("");
  }
  if (typeof child === "string" || typeof child === "number") {
    return document.createTextNode(String(child));
  }

  if (child.type === Fragment) {
    const frag = document.createDocumentFragment();
    for (const c of child.children) {
      frag.appendChild(buildNode(c));
    }
    return frag;
  }

  if (typeof child.type === "function") {
    const fn = child.type as AnyComponentFn;
    const allPropsRaw = mergedProps(child);
    if (!isShown(allPropsRaw)) {
      return document.createTextNode("");
    }
    // Strip $deferred from component props; propagate via context.
    const allProps = stripDeferred(allPropsRaw);
    const compDeferred = allPropsRaw["$deferred"] as boolean | undefined;
    const prevCtxFn = _getCtxMap();
    if (compDeferred) _setCtxMap(_withPriority(prevCtxFn, _getCurrentPriority() + 1));
    try {
      const providerCtx = _getProviderCtx(fn);
      if (providerCtx) {
        return mountContextProvider(fn as PlainComponentFn, allProps, providerCtx).fragment;
      }
      if (isGeneratorFn(fn)) {
        return mountGeneratorComponent(fn, allProps).fragment;
      }
      return mountPlainComponent(fn as PlainComponentFn, allProps);
    } finally {
      if (compDeferred) _setCtxMap(prevCtxFn);
    }
  }

  if (!isShown(child.props)) {
    return document.createTextNode("");
  }

  // HTML element — propagate $patch and $deferred to children via context.
  const el = document.createElement(child.type as string);
  applyProps(el, child.props);
  const elBatch = child.props["$patch"] as "live" | "default" | undefined;
  const elDeferred = child.props["$deferred"] as boolean | undefined;
  const prevCtxBuildNode = _getCtxMap();
  if (elBatch !== undefined) _setCtxMap(_withBatch(prevCtxBuildNode, elBatch));
  if (elDeferred) _setCtxMap(_withPriority(_getCtxMap(), _getCurrentPriority() + 1));
  for (const c of child.children) {
    el.appendChild(buildNode(c));
  }
  if (elBatch !== undefined || elDeferred) _setCtxMap(prevCtxBuildNode);
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
 * **Called by:** `resume` and `executeRerender` in `mountGeneratorComponent`.
 */
function commitOrDefer(instance: GenInstance, vnode: Child): void {
  const parent = instance.endMarker.parentNode as HTMLElement;
  const effectiveBatch =
    (instance.props["$patch"] as "live" | "default" | undefined) ??
    _instanceBatch(instance.capturedCtx);
  const shouldDefer =
    (renderState.patchDepth > 0 || instance.localPatchRefCount > 0) && effectiveBatch !== "live";
  if (shouldDefer) {
    instance.pendingVNode = vnode;
    renderState.dirtyInstances.add(instance);
    const prevLiveOnly = renderState.liveOnlyMode;
    renderState.liveOnlyMode = true;
    try {
      instance.slots = reconcileSlots(parent, instance.slots, [vnode], instance.endMarker);
    } finally {
      renderState.liveOnlyMode = prevLiveOnly;
    }
  } else {
    instance.pendingVNode = undefined;
    instance.slots = reconcileSlots(parent, instance.slots, [vnode], instance.endMarker);
    flushEffects(instance);
  }
}

/**
 * Mount a generator-function component using an end-marker Comment node.
 *
 * This is the heart of the component lifecycle. It:
 * 1. Creates an end-marker Comment node (`<!---->`) that serves as the
 *    component's positional anchor in the parent DOM.
 * 2. Captures the current context map (`capturedCtx`).
 * 3. Creates the `GenInstance` with all mutable state arrays.
 * 4. Defines three closures (`resume`, `executeRerender`, `rerender`) that
 *    close over the instance and drive the component's lifecycle.
 * 5. Calls `executeRerender(false)` to run the initial mount.
 * 6. Returns a `DocumentFragment` containing the initial output nodes and
 *    the endMarker (the caller appends it to the parent DOM).
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a new generator component
 *   appears at a position where a different type was before.
 *
 * @param fn    - The generator function component.
 * @param props - The component's initial props.
 * @returns `{ fragment, genInstance }` — the fragment to insert into the DOM
 *   and the instance for slot tracking.
 */
export function mountGeneratorComponent(
  fn: GeneratorComponentFn,
  props: Record<string, unknown>,
): { fragment: DocumentFragment; genInstance: GenInstance } {
  const endMarker = document.createComment("");

  /**
   * The context map captured at mount time, representing the **inherited**
   * context from ancestors. Does NOT include the component's own `$patch`
   * — that is applied dynamically in `executeRerender` via `_withBatch`.
   */
  const capturedCtx = _getCtxMap();

  /** Priority level captured from the context at mount time. */
  const priority = _getCurrentPriority();

  /** Per-hook persistent state array. See `GenInstance.hookStates`. */
  const hookStates: unknown[] = [];

  /** Per-hook cleanup functions. See `GenInstance.cleanupFns`. */
  const cleanupFns: ((() => void) | undefined)[] = [];

  /** Queued effects for the current render pass. See `GenInstance.pendingEffects`. */
  const pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
    controller: AbortController;
  }> = [];

  // `instance` is assigned before any external code can observe it.
  // `resume`, `rerender`, and `executeRerender` all close over it.
  let instance: GenInstance;

  // Nodes produced by the initial render — collected by the mount function
  // after `executeRerender(false)` returns to build the DocumentFragment.
  let initialFragment: DocumentFragment | null = null;

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
    if (instance.gen === null) return;

    // Restore context: inherited context + own $patch applied for children.
    const prevCtx = _getCtxMap();
    const ownPatchResume = instance.props["$patch"] as "live" | "default" | undefined;
    _setCtxMap(
      ownPatchResume !== undefined
        ? _withBatch(instance.capturedCtx, ownPatchResume)
        : instance.capturedCtx,
    );

    let vnode: Child;
    try {
      const { value, done } = instance.gen.next();
      if (done) {
        instance.gen = null;
      }
      vnode = (value as Child) ?? null;
    } finally {
      _setCtxMap(prevCtx);
    }

    commitOrDefer(instance, vnode);
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
   * 5. Create a fresh generator: `instance.fn(instance.props, rerender)`.
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
   * - The initial mount at the bottom of `mountGeneratorComponent`.
   * - `rerender()` below — for all subsequent re-renders.
   *
   * @param mounted - `false` on initial mount, `true` on rerenders. Controls
   *   whether nodes are stored for fragment assembly or reconciled in place.
   */
  function executeRerender(initiallyMounted: boolean): Promise<void> {
    let mounted = initiallyMounted;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      instance.isRendering = true;
      // Discard any paused generator; the fresh run starts from the top.
      instance.gen = null;
      instance.pendingEffects.length = 0;

      // Reset consumed-context tracking so the new render records a fresh set.
      instance.consumedContexts.clear();

      // Restore context: inherited context + own $patch for children.
      const prevCtx = _getCtxMap();
      const ownPatch = instance.props["$patch"] as "live" | "default" | undefined;
      _setCtxMap(
        ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx,
      );

      let vnode: Child;
      let cancelled = false;
      const prevRenderingPriority = renderState.renderingPriority;
      renderState.renderingPriority = instance.priority;
      try {
        const gen = instance.fn(instance.props, rerender);
        const result = runHooks(gen, instance, rerender, resume);
        instance.gen = result.gen;
        vnode = result.vnode;
        cancelled = result.cancelled;
      } finally {
        _setCtxMap(prevCtx);
        instance.isRendering = false;
        renderState.renderingPriority = prevRenderingPriority;
      }

      if (cancelled) {
        // Revert deps for effects queued during this cancelled render so the
        // retry re-queues them (their deps in hookStates already match).
        for (const pe of instance.pendingEffects) {
          const state = instance.hookStates[pe.hookIndex] as { deps: unknown[] } | undefined;
          if (state) state.deps = [];
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
        const prevLiveOnly = renderState.liveOnlyMode;
        renderState.liveOnlyMode = false;
        instance.slots = reconcileSlots(initialFragment, [], [vnode], endMarker);
        renderState.liveOnlyMode = prevLiveOnly;
        mounted = true;
        flushEffects(instance);
      } else {
        commitOrDefer(instance, vnode);
      }

      // Resolve all Promise<void>s returned by setState calls that were
      // queued during this render batch.
      const resolvers = instance.renderResolvers.splice(0);
      for (const resolve of resolvers) resolve();

      // A follow-up rerender may have been requested (e.g. from an effect or
      // an async callback that fired synchronously after resolve()).
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
   *   `processOneDescriptor($STATE)`.
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
    fn,
    gen: null,
    props,
    endMarker,
    capturedCtx,
    slots: [],
    hookStates,
    cleanupFns,
    pendingEffects,
    pendingVNode: undefined,
    localPatchRefCount: 0,
    isRendering: false,
    pendingRerender: false,
    renderResolvers: [],
    priority,
    _executeRerender: () => executeRerender(true),
    rerender,
    consumedContexts: new Set(),
  };

  executeRerender(false /* not yet mounted */);

  // initialFragment is populated by executeRerender(false) above (endMarker
  // included). TypeScript can't track the mutation across the closure boundary.
  return { fragment: initialFragment as unknown as DocumentFragment, genInstance: instance };
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
  fn: PlainComponentFn,
  props: Record<string, unknown>,
  providerCtx: object,
): { fragment: DocumentFragment; endMarker: Comment; childSlots: Slot[] } {
  const prevCtxMap = _getCtxMap();
  const newCtxMap = new Map(prevCtxMap);
  newCtxMap.set(providerCtx as never, props["value"]);
  _setCtxMap(newCtxMap);

  const endMarker = document.createComment("");
  const fragment = document.createDocumentFragment();
  fragment.appendChild(endMarker);
  let childSlots: Slot[] = [];

  try {
    const vnode = fn(props);
    if (vnode != null) {
      const prevLiveOnly = renderState.liveOnlyMode;
      renderState.liveOnlyMode = false;
      childSlots = reconcileSlots(fragment, [], [vnode], endMarker);
      renderState.liveOnlyMode = prevLiveOnly;
    }
  } finally {
    _setCtxMap(prevCtxMap);
  }
  return { fragment, endMarker, childSlots };
}

/**
 * Mount a plain (non-generator) function component.
 *
 * Called once; the component has no state of its own. If the parent
 * re-renders with different props, the reconciler remounts from scratch
 * (plain components don't have a `GenInstance` to rerender in place).
 *
 * Returns the rendered DOM node directly — no wrapper span is needed
 * because plain components are never reconciled in place. The only
 * exception is Fragment returns: a `DocumentFragment` gets consumed on
 * DOM insertion, so it must be wrapped in a `<span style="display:contents">`
 * to maintain a stable `slot.node` reference for the reconciler.
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a plain component appears at
 *   a position where a different type was before, or when props change
 *   on a same-type plain component (falls through to fresh mount).
 *
 * @param fn    - The plain function component.
 * @param props - The component's props.
 * @returns The rendered DOM node (or a wrapper span for Fragment returns).
 */
export function mountPlainComponent(fn: PlainComponentFn, props: Record<string, unknown>): Node {
  const vnode = fn(props);
  if (vnode == null) return document.createTextNode("");
  const node = buildNode(vnode);
  // DocumentFragment gets consumed on append — its children move to the parent
  // and the fragment itself becomes empty. Wrap in a span to preserve a stable
  // slot.node reference for the reconciler's replaceChild/removeChild calls.
  if (node instanceof DocumentFragment) {
    const host = document.createElement("span");
    host.style.display = "contents";
    host.appendChild(node);
    return host;
  }
  return node;
}
