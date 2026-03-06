import {
  Fragment,
  type VNode,
  type Child,
  type AnyComponentFn,
  type GeneratorComponentFn,
  type PlainComponentFn,
} from '../jsx';
import { _getCtxMap, _setCtxMap, _getProviderCtx } from '../context';
import { type Slot, type GenInstance } from './types';
import { renderState } from './state';
import { applyProps } from './props';
import { isGeneratorFn, mergedProps, isShown } from './helpers';
import { runHooks, flushEffects } from './hooks-runtime';
import { reconcileSlots } from './reconciler';

/**
 * Build DOM nodes from a list of VNodes and return them alongside Slot
 * tracking data.  Fragments are flattened into the parent list.
 */
export function buildVNodeList(vnodes: Child[]): { nodes: Node[]; slots: Slot[] } {
  const nodes: Node[] = [];
  const slots: Slot[] = [];

  for (const child of vnodes) {
    if (child == null || child === false) {
      const node = document.createTextNode('');
      nodes.push(node);
      slots.push({ type: 'empty', node, props: {}, childSlots: [], genInstance: null });
      continue;
    }
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

    if (vnode.type === Fragment) {
      // Flatten fragment children into this level
      const inner = buildVNodeList(vnode.children);
      nodes.push(...inner.nodes);
      slots.push(...inner.slots);
      continue;
    }

    // Check $shown prop – render empty placeholder when $shown === false
    const allPropsForShown = mergedProps(vnode);
    if (!isShown(allPropsForShown)) {
      const node = document.createTextNode('');
      nodes.push(node);
      slots.push({ type: 'empty', node, props: {}, childSlots: [], genInstance: null });
      continue;
    }

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
      const genInstance =
        node instanceof HTMLElement ? (renderState.genInstanceMap.get(node) ?? null) : null;
      nodes.push(node);
      slots.push({ type: vnode.type, node, props: allProps, childSlots: [], genInstance });
      continue;
    }

    // HTML element — propagate $patch to children if specified.
    const el = document.createElement(vnode.type as string);
    applyProps(el, vnode.props);
    const elBatch = vnode.props['$patch'] as 'live' | 'default' | undefined;
    const prevBatchBuild = renderState.currentBatchBehavior;
    if (elBatch !== undefined) renderState.currentBatchBehavior = elBatch;
    const inner = buildVNodeList(vnode.children);
    renderState.currentBatchBehavior = prevBatchBuild;
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
 * Build a real DOM node from a virtual DOM node (or primitive child value).
 *
 * This is the core of the renderer. It handles:
 *  1. Text / number / primitive children → TextNode
 *  2. `null` / `undefined` / `false` → empty TextNode (renders nothing)
 *  3. `Fragment` → DocumentFragment containing children
 *  4. Generator-function components → mounted via `mountGeneratorComponent`
 *  5. Plain-function components → called once and their output is built
 *  6. HTML tag strings → real HTMLElement with props and children
 */
export function buildNode(child: Child): Node {
  if (child == null || child === false) {
    return document.createTextNode('');
  }
  if (typeof child === 'string' || typeof child === 'number') {
    return document.createTextNode(String(child));
  }

  const vnode = child as VNode;

  if (vnode.type === Fragment) {
    const frag = document.createDocumentFragment();
    for (const c of vnode.children) {
      frag.appendChild(buildNode(c));
    }
    return frag;
  }

  if (typeof vnode.type === 'function') {
    const fn = vnode.type as AnyComponentFn;
    const allProps = mergedProps(vnode);
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

  if (!isShown(vnode.props)) {
    return document.createTextNode('');
  }

  const el = document.createElement(vnode.type as string);
  applyProps(el, vnode.props);
  for (const c of vnode.children) {
    el.appendChild(buildNode(c));
  }
  return el;
}

/**
 * Mount a generator-function component into a `display:contents` host span.
 * Registers a GenInstance so that `rerender()` can reconcile efficiently.
 *
 * Components **return** their JSX (done=true).  Hooks yield descriptor objects
 * that are intercepted by `runHooks`; real VNode yields (done=false) pause the
 * generator (e.g. `useResolve` showing a loading spinner).  When a hook yields
 * a real VNode, the generator is stored and resumed on the next `rerender()`.
 * When the generator returns, it is discarded and a fresh one is created on
 * the next `rerender()`.
 */
export function mountGeneratorComponent(
  fn: GeneratorComponentFn,
  props: Record<string, unknown>,
): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';

  const capturedCtx = _getCtxMap();
  const hookStates: unknown[] = [];
  const cleanupFns: ((() => void) | undefined)[] = [];
  const pendingEffects: Array<{ hookIndex: number; fn: () => (() => void) | void }> = [];

  // `instance` is assigned before any external code can observe it.
  // `resume`, `rerender`, and `executeRerender` all close over it.
  let instance: GenInstance;

  /**
   * Called when a paused generator (e.g. inside useResolve) is ready to
   * continue.  Resumes the stored generator one step and reconciles the DOM.
   */
  function resume(): void {
    if (instance.gen === null) return;

    const prevCtx = _getCtxMap();
    _setCtxMap(instance.capturedCtx);

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

    const shouldDefer =
      (renderState.patchDepth > 0 || instance.localPatchRefCount > 0) &&
      instance.batchBehavior !== 'live';
    if (shouldDefer) {
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
      instance.pendingVNode = undefined;
      instance.slots = reconcileSlots(host, instance.slots, [vnode]);
      flushEffects(instance);
    }
  }

  /**
   * Runs the generator body in a loop, retrying whenever a mid-render state
   * change is detected.  Both the initial mount and all subsequent rerenders
   * use this function so the cancellation logic is shared.
   *
   * On the initial call `mounted` is false; the first successful render
   * appends nodes to the host.  On subsequent calls it reconciles in place.
   */
  function executeRerender(mounted: boolean): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      instance.isRendering = true;
      // Discard any paused generator; the fresh run starts from the top.
      instance.gen = null;
      instance.pendingEffects.length = 0;

      const prevCtx = _getCtxMap();
      _setCtxMap(instance.capturedCtx);
      const prevBatch = renderState.currentBatchBehavior;
      renderState.currentBatchBehavior = instance.batchBehavior;

      let vnode: Child;
      let cancelled = false;
      try {
        const gen = instance.fn(instance.props, rerender);
        const result = runHooks(gen, instance, rerender, resume);
        instance.gen = result.gen;
        vnode = result.vnode;
        cancelled = result.cancelled;
      } finally {
        renderState.currentBatchBehavior = prevBatch;
        _setCtxMap(prevCtx);
        instance.isRendering = false;
      }

      if (cancelled) {
        // A mid-render setState was queued — retry with the accumulated state.
        instance.pendingRerender = false;
        continue;
      }

      // ── Commit ──
      if (!mounted) {
        // Initial mount: build nodes and append to the host element.
        const { nodes, slots } = buildVNodeList([vnode]);
        instance.slots = slots;
        for (const n of nodes) host.appendChild(n);
        mounted = true;
        flushEffects(instance);
      } else {
        // Rerender: reconcile existing DOM in place.
        const shouldDefer =
          (renderState.patchDepth > 0 || instance.localPatchRefCount > 0) &&
          instance.batchBehavior !== 'live';
        if (shouldDefer) {
          instance.pendingVNode = vnode;
          renderState.dirtyInstances.add(instance);
          // Immediately flush any $patch="live" descendants even though this
          // component itself is frozen.
          const prevLiveOnly = renderState.liveOnlyMode;
          renderState.liveOnlyMode = true;
          try {
            instance.slots = reconcileSlots(host, instance.slots, [vnode]);
          } finally {
            renderState.liveOnlyMode = prevLiveOnly;
          }
        } else {
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
   * Called by useState setters and external rerender requests.
   *
   * If a render is already in progress (isRendering), the request is queued:
   * `pendingRerender` is set so the active `runHooks` loop exits early, and
   * a Promise is returned that resolves after the next committed render.
   *
   * Otherwise `executeRerender` is called immediately.
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
  // Resolve $patch from own prop (if set) falling back to the inherited value.
  const ownBatch =
    (props['$patch'] as 'live' | 'default' | undefined) ?? renderState.currentBatchBehavior;
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
    batchBehavior: ownBatch,
    pendingVNode: undefined,
    localPatchRefCount: 0,
    isRendering: false,
    pendingRerender: false,
    renderResolvers: [],
    rerender,
  };
  renderState.genInstanceMap.set(host, instance);

  executeRerender(false /* not yet mounted */);

  return host;
}

/**
 * Mount a context Provider.  Updates `_ctxMap` before building children,
 * then restores it afterwards.
 *
 * Returns both the host node and the child Slot array so that the reconciler
 * can update children in-place on subsequent renders without remounting the
 * Provider or its descendants.
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
      // The Provider returns a Fragment wrapping its children – build them
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
 * Called once; has no state of its own.
 */
export function mountPlainComponent(fn: PlainComponentFn, props: Record<string, unknown>): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';
  const vnode = fn(props);
  if (vnode != null) host.appendChild(buildNode(vnode));
  return host;
}
