/**
 * mount.ts — Initial DOM construction and generator component lifecycle.
 *
 * This module handles:
 * 1. **Building** DOM nodes from VNode trees (`buildVNodeList`, `buildNode`).
 * 2. **Mounting** generator components (`mountGeneratorComponent`) — creates
 *    the host span, the `GenInstance`, and defines `resume`, `executeRerender`,
 *    and `rerender` closures that drive the component's lifecycle.
 * 3. **Mounting** plain function components (`mountPlainComponent`).
 * 4. **Mounting** context Providers (`mountContextProvider`).
 */

import {
  Fragment,
  type VNode,
  type Child,
  type AnyComponentFn,
  type GeneratorComponentFn,
  type PlainComponentFn,
} from '../jsx';
import {
  _getCtxMap,
  _setCtxMap,
  _getProviderCtx,
  _getCurrentBatch,
  _instanceBatch,
  _withBatch,
} from '../context';
import { type Slot, type GenInstance } from './types';
import { renderState } from './state';
import { applyProps } from './props';
import { isGeneratorFn, mergedProps, isShown } from './helpers';
import { runHooks, flushEffects } from './hooks-runtime';
import { reconcileSlots } from './reconciler';

/**
 * Build DOM nodes from a list of VNodes and return them alongside Slot
 * tracking data. Fragments are flattened into the parent list.
 *
 * This is the primary **initial mount** function for child lists. Unlike
 * `reconcileSlots` (which diffs against existing slots), this builds
 * everything from scratch.
 *
 * **Called by:**
 * - `executeRerender` in `mountGeneratorComponent` — on initial mount,
 *   builds the component's first render output.
 * - `reconcileOne` in `reconciler.ts` — when building a fresh HTML element
 *   (different tag from previous).
 * - `mountContextProvider` — builds the Provider's children.
 *
 * @param vnodes - The child VNodes to build.
 * @returns `{ nodes, slots }` — parallel arrays of real DOM nodes and
 *   their corresponding Slot tracking objects.
 */
export function buildVNodeList(vnodes: Child[]): { nodes: Node[]; slots: Slot[] } {
  const nodes: Node[] = [];
  const slots: Slot[] = [];

  for (const child of vnodes) {
    // null / undefined / false → empty text node placeholder
    if (child == null || child === false) {
      const node = document.createTextNode('');
      nodes.push(node);
      slots.push({ type: 'empty', node, props: {}, childSlots: [], genInstance: null });
      continue;
    }
    // string / number → text node
    if (typeof child === 'string' || typeof child === 'number') {
      const node = document.createTextNode(String(child));
      nodes.push(node);
      slots.push({
        type: 'text',
        node,
        props: { text: String(child) },
        childSlots: [],
        genInstance: null,
      });
      continue;
    }

    const vnode = child as VNode;

    // Fragment → flatten children into this level (no DOM wrapper)
    if (vnode.type === Fragment) {
      const inner = buildVNodeList(vnode.children);
      nodes.push(...inner.nodes);
      slots.push(...inner.slots);
      continue;
    }

    // Check $shown prop — render empty placeholder when $shown === false
    const allPropsForShown = mergedProps(vnode);
    if (!isShown(allPropsForShown)) {
      const node = document.createTextNode('');
      nodes.push(node);
      slots.push({ type: 'empty', node, props: {}, childSlots: [], genInstance: null });
      continue;
    }

    // Function component (generator, plain, or Provider)
    if (typeof vnode.type === 'function') {
      const fn = vnode.type as AnyComponentFn;
      const allProps = allPropsForShown;
      const providerCtx = _getProviderCtx(fn);
      if (providerCtx) {
        const { node, childSlots } = mountContextProvider(
          fn as PlainComponentFn,
          allProps,
          providerCtx,
        );
        nodes.push(node);
        slots.push({ type: vnode.type, node, props: allProps, childSlots, genInstance: null });
        continue;
      }
      let node: Node;
      if (isGeneratorFn(fn)) {
        node = mountGeneratorComponent(fn, allProps);
      } else {
        node = mountPlainComponent(fn as PlainComponentFn, allProps);
      }
      // Look up the GenInstance from the host span (registered by mountGeneratorComponent)
      const genInstance =
        node instanceof HTMLElement ? (renderState.genInstanceMap.get(node) ?? null) : null;
      nodes.push(node);
      slots.push({ type: vnode.type, node, props: allProps, childSlots: [], genInstance });
      continue;
    }

    // HTML element — create the element, apply props, build children.
    // If the element has a $patch prop, propagate it to children via
    // the context map (save/restore pattern).
    const el = document.createElement(vnode.type as string);
    applyProps(el, vnode.props);
    const elBatch = vnode.props['$patch'] as 'live' | 'default' | undefined;
    const prevCtxBuild = _getCtxMap();
    if (elBatch !== undefined) _setCtxMap(_withBatch(prevCtxBuild, elBatch));
    const inner = buildVNodeList(vnode.children);
    if (elBatch !== undefined) _setCtxMap(prevCtxBuild);
    for (const c of inner.nodes) el.appendChild(c);
    nodes.push(el);
    slots.push({
      type: vnode.type as string,
      node: el,
      props: vnode.props,
      childSlots: inner.slots,
      genInstance: null,
    });
  }

  return { nodes, slots };
}

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
 * @returns The real DOM node.
 */
export function buildNode(child: Child): Node {
  if (child == null || typeof child === 'boolean') {
    return document.createTextNode('');
  }
  if (typeof child === 'string' || typeof child === 'number') {
    return document.createTextNode(String(child));
  }

  if (child.type === Fragment) {
    const frag = document.createDocumentFragment();
    for (const c of child.children) {
      frag.appendChild(buildNode(c));
    }
    return frag;
  }

  if (typeof child.type === 'function') {
    const fn = child.type as AnyComponentFn;
    const allProps = mergedProps(child);
    if (!isShown(allProps)) {
      return document.createTextNode('');
    }
    const providerCtx = _getProviderCtx(fn);
    if (providerCtx) {
      return mountContextProvider(fn as PlainComponentFn, allProps, providerCtx).node;
    }
    return isGeneratorFn(fn)
      ? mountGeneratorComponent(fn, allProps)
      : mountPlainComponent(fn as PlainComponentFn, allProps);
  }

  if (!isShown(child.props)) {
    return document.createTextNode('');
  }

  // HTML element — propagate $patch to children via context (same as buildVNodeList).
  const el = document.createElement(child.type as string);
  applyProps(el, child.props);
  const elBatch = child.props['$patch'] as 'live' | 'default' | undefined;
  const prevCtxBuildNode = _getCtxMap();
  if (elBatch !== undefined) _setCtxMap(_withBatch(prevCtxBuildNode, elBatch));
  for (const c of child.children) {
    el.appendChild(buildNode(c));
  }
  if (elBatch !== undefined) _setCtxMap(prevCtxBuildNode);
  return el;
}

/**
 * Mount a generator-function component into a `display:contents` host span.
 *
 * This is the heart of the component lifecycle. It:
 * 1. Creates a `<span style="display:contents">` host element.
 * 2. Captures the current context map (`capturedCtx`).
 * 3. Creates the `GenInstance` with all mutable state arrays.
 * 4. Defines three closures (`resume`, `executeRerender`, `rerender`) that
 *    close over the instance and drive the component's lifecycle.
 * 5. Calls `executeRerender(false)` to run the initial mount.
 * 6. Registers the instance in `renderState.genInstanceMap`.
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a new generator component
 *   appears at a position where a different type was before.
 *
 * @param fn    - The generator function component.
 * @param props - The component's initial props.
 * @returns The host `<span>` element (with children appended inside).
 */
export function mountGeneratorComponent(
  fn: GeneratorComponentFn,
  props: Record<string, unknown>,
): Node {
  // This should probably be the actual parent element
  const host = document.createElement('span');
  host.style.display = 'contents';

  /**
   * The context map captured at mount time, representing the **inherited**
   * context from ancestors. Does NOT include the component's own `$patch`
   * — that is applied dynamically in `executeRerender` via `_withBatch`.
   *
   * This separation ensures:
   * - Context change detection compares inherited contexts only.
   * - `usePatchContext` consumers see the effective (inherited + own) batch.
   */
  const capturedCtx = _getCtxMap();

  /** Per-hook persistent state array. See `GenInstance.hookStates`. */
  const hookStates: unknown[] = [];

  /** Per-hook cleanup functions. See `GenInstance.cleanupFns`. */
  const cleanupFns: ((() => void) | undefined)[] = [];

  /** Queued effects for the current render pass. See `GenInstance.pendingEffects`. */
  const pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | void;
    controller: AbortController;
  }> = [];

  // `instance` is assigned before any external code can observe it.
  // `resume`, `rerender`, and `executeRerender` all close over it.
  let instance: GenInstance;

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
    const ownPatchResume = instance.props['$patch'] as 'live' | 'default' | undefined;
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

    // Determine whether to defer this update or commit immediately.
    // effectiveBatch = own $patch OR inherited batch from capturedCtx.
    const effectiveBatch =
      (instance.props['$patch'] as 'live' | 'default' | undefined) ??
      _instanceBatch(instance.capturedCtx);
    const shouldDefer =
      (renderState.patchDepth > 0 || instance.localPatchRefCount > 0) && effectiveBatch !== 'live';
    if (shouldDefer) {
      // Store the VNode for later commit; run a live-only pass for $patch="live" descendants.
      instance.pendingVNode = vnode;
      renderState.dirtyInstances.add(instance);
      const prevLiveOnly = renderState.liveOnlyMode;
      renderState.liveOnlyMode = true;
      try {
        instance.slots = reconcileSlots(host, instance.slots, [vnode]);
      } finally {
        renderState.liveOnlyMode = prevLiveOnly;
      }
    } else {
      // No patch active — commit immediately.
      instance.pendingVNode = undefined;
      instance.slots = reconcileSlots(host, instance.slots, [vnode]);
      flushEffects(instance);
    }
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
   *    - Initial mount: `buildVNodeList` → append to host.
   *    - Rerender: check `shouldDefer` → either store `pendingVNode` or
   *      `reconcileSlots` immediately.
   * 10. Resolve any `renderResolvers` (awaited setState promises).
   * 11. If `pendingRerender` is set → loop again for follow-up rerender.
   *
   * **Called by:**
   * - The initial mount at the bottom of `mountGeneratorComponent`.
   * - `rerender()` below — for all subsequent re-renders.
   *
   * @param mounted - `false` on initial mount, `true` on rerenders. Controls
   *   whether nodes are appended to the host or reconciled in place.
   */
  function executeRerender(mounted: boolean): Promise<void> {
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
      const ownPatch = instance.props['$patch'] as 'live' | 'default' | undefined;
      _setCtxMap(
        ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx,
      );

      let vnode: Child;
      let cancelled = false;
      try {
        const gen = instance.fn(instance.props, rerender);
        const result = runHooks(gen, instance, rerender, resume);
        instance.gen = result.gen;
        vnode = result.vnode;
        cancelled = result.cancelled;
      } finally {
        _setCtxMap(prevCtx);
        instance.isRendering = false;
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
        // Initial mount: build DOM nodes and append to the host element.
        const { nodes, slots } = buildVNodeList([vnode]);
        instance.slots = slots;
        for (const n of nodes) host.appendChild(n);
        mounted = true;
        flushEffects(instance);
      } else {
        // Rerender: reconcile existing DOM in place.
        // Compute the effective batch to determine whether to defer.
        const effBatch =
          (instance.props['$patch'] as 'live' | 'default' | undefined) ??
          _instanceBatch(instance.capturedCtx);
        const shouldDefer =
          (renderState.patchDepth > 0 || instance.localPatchRefCount > 0) && effBatch !== 'live';
        if (shouldDefer) {
          // Store VNode for later commit by commitUIPatch / local commit.
          instance.pendingVNode = vnode;
          renderState.dirtyInstances.add(instance);
          // Run a live-only pass to immediately flush $patch="live" descendants.
          const prevLiveOnly = renderState.liveOnlyMode;
          renderState.liveOnlyMode = true;
          try {
            instance.slots = reconcileSlots(host, instance.slots, [vnode]);
          } finally {
            renderState.liveOnlyMode = prevLiveOnly;
          }
        } else {
          // No patch active — commit immediately.
          instance.pendingVNode = undefined;
          instance.slots = reconcileSlots(host, instance.slots, [vnode]);
          flushEffects(instance);
        }
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
   *   `processOneDescriptor(USE_STATE)`.
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
    return executeRerender(true /* already mounted */);
  }

  // ── Initial mount ──
  // Create the instance before calling runHooks so that processOneDescriptor
  // (e.g. USE_UI_PATCH) can close over the fully-typed instance object.
  //
  // capturedCtx stores the inherited batch from the parent context.
  // The component's own $patch (if any) is applied dynamically during
  // executeRerender, so that usePatchContext consumers see the effective batch
  // while context change detection compares inherited batches only.
  instance = {
    fn,
    gen: null,
    props,
    host,
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
    rerender,
    consumedContexts: new Set(),
  };
  renderState.genInstanceMap.set(host, instance);

  executeRerender(false /* not yet mounted */);

  return host;
}

/**
 * Mount a context Provider component.
 *
 * Pushes the Provider's `value` onto the context map, builds the
 * Provider's children (which see the new value), then restores the
 * previous context map.
 *
 * Returns the host span and child Slot array so that the reconciler
 * can update children in-place on subsequent renders without remounting
 * the Provider or its descendants.
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a new Provider appears at
 *   a position where a different type was before.
 *
 * @param fn          - The Provider function (created by `createContext`).
 * @param props       - The Provider's props (includes `value` and `children`).
 * @param providerCtx - The Context object this Provider supplies.
 * @returns `{ node, childSlots }` — the host span and Slot tracking for children.
 */
export function mountContextProvider(
  fn: PlainComponentFn,
  props: Record<string, unknown>,
  providerCtx: object,
): { node: HTMLElement; childSlots: Slot[] } {
  const prevCtxMap = _getCtxMap();
  const newCtxMap = new Map(prevCtxMap);
  newCtxMap.set(providerCtx as never, props.value);
  _setCtxMap(newCtxMap);

  const host = document.createElement('span');
  host.style.display = 'contents';
  let childSlots: Slot[] = [];

  try {
    const vnode = fn(props);
    if (vnode != null) {
      // The Provider returns a Fragment wrapping its children — build them.
      const { nodes, slots } = buildVNodeList([vnode]);
      for (const n of nodes) host.appendChild(n);
      childSlots = slots;
    }
  } finally {
    _setCtxMap(prevCtxMap);
  }

  return { node: host, childSlots };
}

/**
 * Mount a plain (non-generator) function component.
 *
 * Called once; the component has no state of its own. If the parent
 * re-renders with different props, the reconciler remounts from scratch
 * (plain components don't have a `GenInstance` to rerender in place).
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a plain component appears at
 *   a position where a different type was before, or when props change
 *   on a same-type plain component (falls through to fresh mount).
 *
 * @param fn    - The plain function component.
 * @param props - The component's props.
 * @returns The host `<span style="display:contents">` element.
 */
export function mountPlainComponent(fn: PlainComponentFn, props: Record<string, unknown>): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';
  const vnode = fn(props);
  if (vnode != null) host.appendChild(buildNode(vnode));
  return host;
}
