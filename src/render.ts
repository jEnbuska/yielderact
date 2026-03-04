import {
  Fragment,
  VNode,
  Child,
  GeneratorComponentFn,
  PlainComponentFn,
  AnyComponentFn,
} from './jsx';
import { _getCtxMap, _setCtxMap, _getProviderCtx, USE_CONTEXT, type Context } from './context';
import { createSyntheticEvent, type SyntheticEvent } from './events';
import {
  USE_STATE,
  USE_REF,
  USE_ID,
  USE_MEMO,
  USE_RESOLVE_RAW,
  USE_RESOLVE,
  USE_EFFECT,
  USE_RENDER,
  depsChanged,
  type ResolveRawResult,
  type UseRenderState,
} from './hooks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when `fn` is a generator function (i.e. uses `function*`). */
function isGeneratorFn(fn: AnyComponentFn): fn is GeneratorComponentFn {
  return fn.constructor.name === 'GeneratorFunction';
}

/** Remove all child nodes from a DOM element. */
function clearChildren(node: Node): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/** Shallow equality check for props objects. */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => Object.is(a[k], b[k]));
}

/** Flatten Fragment VNodes into a flat list of non-Fragment children. */
function flattenChildren(children: Child[]): Child[] {
  const result: Child[] = [];
  for (const child of children) {
    if (child != null && typeof child === 'object' && (child as VNode).type === Fragment) {
      result.push(...flattenChildren((child as VNode).children));
    } else {
      result.push(child);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Prop application
// ---------------------------------------------------------------------------
// Event listener tracking
// ---------------------------------------------------------------------------

/**
 * Maps each DOM element to its currently-registered synthetic event wrappers.
 * Key is the lowercase event name (e.g. `"click"`).
 * This lets `updateProps` remove the exact wrapper added by `applyProps`.
 */
const listenerWrappers = new WeakMap<HTMLElement, Map<string, EventListener>>();

function addSyntheticListener(
  el: HTMLElement,
  eventName: string,
  handler: (e: SyntheticEvent) => void,
): void {
  const wrapper: EventListener = (nativeEvent: Event) => handler(createSyntheticEvent(nativeEvent));
  el.addEventListener(eventName, wrapper);
  let map = listenerWrappers.get(el);
  if (!map) {
    map = new Map();
    listenerWrappers.set(el, map);
  }
  map.set(eventName, wrapper);
}

function removeSyntheticListener(el: HTMLElement, eventName: string): void {
  const wrapper = listenerWrappers.get(el)?.get(eventName);
  if (wrapper) {
    el.removeEventListener(eventName, wrapper);
    listenerWrappers.get(el)!.delete(eventName);
  }
}

// ---------------------------------------------------------------------------
// Prop application
// ---------------------------------------------------------------------------

/**
 * Apply a VNode's props to a real DOM element.
 *
 * - `onXxx` props become synthetic-event listeners
 * - `className` maps to `element.className`
 * - `htmlFor` maps to the `for` HTML attribute
 * - `style` (object) is merged into `element.style`
 * - Everything else becomes an HTML attribute
 */
function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === '$shown') continue;
    if (key.startsWith('on') && typeof value === 'function') {
      addSyntheticListener(el, key.slice(2).toLowerCase(), value as (e: SyntheticEvent) => void);
    } else if (key === 'className') {
      el.className = String(value);
    } else if (key === 'htmlFor') {
      el.setAttribute('for', String(value));
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      Object.assign(el.style, value);
    } else if (
      key === 'value' &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement)
    ) {
      // Use the DOM property so the live value is updated, not just the default
      (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = String(
        value ?? '',
      );
    } else if (key === 'checked' && el instanceof HTMLInputElement) {
      // Use the DOM property for checkboxes
      el.checked = Boolean(value);
    } else if (value != null) {
      el.setAttribute(key, String(value));
    }
  }

  // Default <button> type to "button" to prevent accidental form submission.
  // The HTML default is "submit", which is almost never the intended behaviour.
  if (el instanceof HTMLButtonElement && !el.hasAttribute('type')) {
    el.setAttribute('type', 'button');
  }

  // Warn when <a target="_blank"> is used without any rel attribute.
  // Without rel the opened page can navigate the opener via window.opener (tab-napping).
  if (
    el instanceof HTMLAnchorElement &&
    el.getAttribute('target') === '_blank' &&
    !el.getAttribute('rel')
  ) {
    console.warn(
      'yielderact: <a target="_blank"> is missing rel="noopener". ' +
        'Add rel="noopener noreferrer" to prevent tab-napping attacks.',
    );
  }
}

/**
 * Diff and update props on an existing DOM element.
 * Removes stale event listeners/attributes and applies new ones.
 */
function updateProps(
  el: HTMLElement,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  // Always remove old event listeners (they may be replaced by new functions)
  for (const key in prevProps) {
    if (key === 'children' || key === 'style' || key === '$shown') continue;
    if (key.startsWith('on') && typeof prevProps[key] === 'function') {
      removeSyntheticListener(el, key.slice(2).toLowerCase());
    } else if (!(key in nextProps)) {
      if (key === 'className') {
        el.className = '';
      } else if (key === 'htmlFor') {
        el.removeAttribute('for');
      } else {
        el.removeAttribute(key);
      }
    }
  }
  // Apply all current props (re-adds event listeners + sets attrs)
  applyProps(el, nextProps);
}

// ---------------------------------------------------------------------------
// Instance tracking
// ---------------------------------------------------------------------------

/**
 * A "slot" tracks one reconciled position in the rendered DOM tree.
 * It records the type that was rendered, the DOM node, and (for components)
 * the running generator instance.
 */
interface Slot {
  /** The VNode type that produced this slot, or 'text'/'empty' for primitives. */
  type: VNode['type'] | 'text' | 'empty';
  /** The actual DOM node (Text, HTMLElement, or component host span). */
  node: Node;
  /** The props at last render (used for shallow-equality memoization). */
  props: Record<string, unknown>;
  /** Slots for the element's direct children (HTML elements only). */
  childSlots: Slot[];
  /** Running generator instance, present only for generator components. */
  genInstance: GenInstance | null;
}

/** State held for one running generator component. */
interface GenInstance {
  fn: GeneratorComponentFn;
  /**
   * The active generator for this component.
   *
   * - Non-null when the generator has yielded (a hook intercepted rendering,
   *   e.g. `useResolve` is waiting for a promise).  The generator will be
   *   resumed via `gen.next()` on the next `rerender()` call.
   * - `null` when the generator has returned (component completed its render).
   *   A fresh generator is created on the next `rerender()` call.
   */
  gen: Generator<unknown, Child, unknown> | null;
  props: Record<string, unknown>;
  host: HTMLElement;
  /** The context map that was active when this component was mounted. */
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>;
  /** Reconciled slots representing the generator's last rendered output. */
  slots: Slot[];
  /**
   * Persistent hook state storage.  Each entry corresponds to one hook
   * descriptor yielded in the component body (by call-order index).  This
   * array survives across re-renders so that `useState` values and
   * `useResolve` promise statuses are preserved.
   */
  hookStates: unknown[];
  /**
   * Per-hook-slot cleanup functions (parallel to `hookStates`).
   * Called when the component unmounts or a hook resets its state (e.g.
   * `useResolve` aborts its AbortController when deps change).
   */
  cleanupFns: ((() => void) | undefined)[];
  /**
   * Effects queued during the current render pass (by `useEffect` descriptors).
   * Flushed after the DOM is updated, but only when the generator has fully
   * returned (gen === null). Cleared at the start of each render pass.
   */
  pendingEffects: Array<{ hookIndex: number; fn: () => (() => void) | void }>;
}

/** Map from a generator component's host span to its instance. */
const genInstanceMap = new WeakMap<HTMLElement, GenInstance>();

// ---------------------------------------------------------------------------
// Hook descriptor processing
// ---------------------------------------------------------------------------

/** Counter for stable unique IDs produced by `useId`. */
let _idCounter = 0;

/** Set of all known hook descriptor type symbols for fast membership test. */
const HOOK_SYMBOLS = new Set<symbol>([
  USE_STATE,
  USE_REF,
  USE_ID,
  USE_MEMO,
  USE_CONTEXT,
  USE_RESOLVE_RAW,
  USE_RESOLVE,
  USE_EFFECT,
  USE_RENDER,
]);

/** Returns true when a yielded value is a hook descriptor (not a VNode/Child). */
function isHookDescriptor(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    HOOK_SYMBOLS.has((value as { type: symbol }).type)
  );
}

/**
 * Run any effects that were queued during the last render pass.
 * Only fires when the generator has fully returned (gen === null), meaning the
 * component is not mid-interaction (e.g. waiting inside useRender).
 * Cleanup from the previous effect at each slot is stored in hookStates so
 * that unmountSlot can call it via cleanupFns.
 */
function flushEffects(instance: GenInstance): void {
  if (instance.gen !== null) return;
  for (const { hookIndex, fn } of instance.pendingEffects) {
    const cleanup = fn();
    (instance.hookStates[hookIndex] as { deps: unknown[]; cleanup: (() => void) | void }).cleanup =
      cleanup;
  }
  instance.pendingEffects.length = 0;
}

/**
 * Recursively call cleanup functions for a slot and all its descendants.
 * Called when a slot is about to be replaced or removed from the DOM.
 */
function unmountSlot(slot: Slot): void {
  for (const child of slot.childSlots) {
    unmountSlot(child);
  }
  if (slot.genInstance) {
    for (const child of slot.genInstance.slots) {
      unmountSlot(child);
    }
    for (const fn of slot.genInstance.cleanupFns) {
      fn?.();
    }
  }
}

/**
 * Process a single hook descriptor and return the value to send back to the
 * generator via `gen.next(value)`.
 */
function processOneDescriptor(
  descriptor: { type: symbol; [key: string]: unknown },
  hookIndex: number,
  hookStates: unknown[],
  cleanupFns: ((() => void) | undefined)[],
  pendingEffects: Array<{ hookIndex: number; fn: () => (() => void) | void }>,
  rerender: () => void,
  resume: () => void,
): unknown {
  switch (descriptor.type) {
    case USE_STATE: {
      if (!(hookIndex in hookStates)) {
        const init = descriptor['initialValue'];
        hookStates[hookIndex] = typeof init === 'function' ? (init as () => unknown)() : init;
      }
      const setter = (newValue: unknown): void => {
        hookStates[hookIndex] =
          typeof newValue === 'function'
            ? (newValue as (prev: unknown) => unknown)(hookStates[hookIndex])
            : newValue;
        rerender();
      };
      return [hookStates[hookIndex], setter];
    }

    case USE_REF: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = { current: descriptor['initialValue'] };
      }
      return hookStates[hookIndex];
    }

    case USE_ID: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = `:r${_idCounter++}:`;
      }
      return hookStates[hookIndex];
    }

    case USE_MEMO: {
      const fn = descriptor['fn'] as (...args: unknown[]) => unknown;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as { value: unknown; deps: unknown[] } | undefined;
      if (!existing || depsChanged(existing.deps, deps)) {
        hookStates[hookIndex] = { value: fn(...deps), deps };
      }
      return (hookStates[hookIndex] as { value: unknown }).value;
    }

    case USE_CONTEXT: {
      const ctx = descriptor['ctx'] as Context<unknown>;
      const ctxMap = _getCtxMap();
      const value = ctxMap.get(ctx);
      return value !== undefined ? value : ctx._defaultValue;
    }

    case USE_RESOLVE_RAW: {
      type RawState =
        | { promise: Promise<unknown>; status: 'pending' }
        | { promise: Promise<unknown>; status: 'resolved'; data: unknown }
        | { promise: Promise<unknown>; status: 'rejected'; error: unknown };

      const promise = descriptor['promise'] as Promise<unknown>;
      const existing = hookStates[hookIndex] as RawState | undefined;

      if (!existing || existing.promise !== promise) {
        const state: RawState = { promise, status: 'pending' };
        hookStates[hookIndex] = state;
        promise.then(
          (data) => {
            if (hookStates[hookIndex] === state) {
              hookStates[hookIndex] = { promise, status: 'resolved', data };
              rerender();
            }
          },
          (error) => {
            if (hookStates[hookIndex] === state) {
              hookStates[hookIndex] = { promise, status: 'rejected', error };
              rerender();
            }
          },
        );
      }

      const s = hookStates[hookIndex] as RawState;
      if (s.status === 'resolved')
        return { data: s.data, loading: false, error: undefined } as ResolveRawResult<unknown>;
      if (s.status === 'rejected')
        return { data: undefined, loading: false, error: s.error } as ResolveRawResult<unknown>;
      return { data: undefined, loading: true, error: undefined } as ResolveRawResult<unknown>;
    }

    case USE_RESOLVE: {
      type ResolveState = {
        deps: unknown[];
        promise: Promise<unknown>;
        controller: AbortController;
      };
      const fn = descriptor['fn'] as (signal: AbortSignal) => Promise<unknown>;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as ResolveState | undefined;

      if (!existing || depsChanged(existing.deps, deps)) {
        // Abort the previous controller before starting a new fetch.
        existing?.controller.abort();
        const controller = new AbortController();
        const promise = fn(controller.signal);
        hookStates[hookIndex] = { deps, promise, controller } satisfies ResolveState;
        // Register cleanup so the controller is aborted on component unmount.
        cleanupFns[hookIndex] = () => controller.abort();
        return promise;
      }
      return existing.promise;
    }

    case USE_EFFECT: {
      type EffectState = { deps: unknown[]; cleanup: (() => void) | void };
      const fn = descriptor['fn'] as () => (() => void) | void;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as EffectState | undefined;

      if (!existing || depsChanged(existing.deps, deps)) {
        // Run cleanup of the previous effect synchronously before the new one.
        existing?.cleanup?.();
        // Store updated deps; cleanup will be filled in by flushEffects after DOM update.
        hookStates[hookIndex] = { deps, cleanup: undefined } satisfies EffectState;
        // Queue the effect to run after reconciliation.
        pendingEffects.push({ hookIndex, fn });
        // Register unmount cleanup that reads the stored cleanup from hookStates.
        cleanupFns[hookIndex] = () => {
          (hookStates[hookIndex] as EffectState).cleanup?.();
        };
      }
      return undefined;
    }

    case USE_RENDER: {
      const deps = descriptor['deps'] as unknown[];
      let slot = hookStates[hookIndex] as UseRenderState<unknown> | undefined;

      if (!slot || depsChanged(slot.deps, deps)) {
        // New slot – create a fresh resumeCallback that closes over the slot ref.
        const newSlot: UseRenderState<unknown> = {
          status: 'waiting',
          deps,
          value: undefined,
          resumeCallback: null!,
        };
        hookStates[hookIndex] = newSlot;
        newSlot.resumeCallback = (value: unknown): void => {
          const s = hookStates[hookIndex] as UseRenderState<unknown>;
          if (s.status === 'waiting') {
            s.status = 'resolved';
            s.value = value;
            resume();
          }
        };
        slot = newSlot;
      } else {
        // Same deps – reuse stable callback, just reset status for this fresh run.
        slot.status = 'waiting';
      }

      return { slot, resumeCallback: slot.resumeCallback };
    }

    default:
      throw new Error(`Unknown hook descriptor type: ${String(descriptor.type)}`);
  }
}

/**
 * Execute the component generator body, intercepting hook descriptors.
 *
 * Runs `gen.next()` in a loop: whenever the generator yields a hook descriptor
 * the descriptor is processed and the result is sent back via `gen.next(result)`.
 * The loop exits when the generator either returns (done) or yields a real VNode
 * (render output that the reconciler should display).
 *
 * Returns the VNode to reconcile and the generator to store (null if done).
 */
function runHooks(
  gen: Generator<unknown, Child, unknown>,
  hookStates: unknown[],
  cleanupFns: ((() => void) | undefined)[],
  pendingEffects: Array<{ hookIndex: number; fn: () => (() => void) | void }>,
  rerender: () => void,
  resume: () => void,
): { vnode: Child; gen: Generator<unknown, Child, unknown> | null } {
  let hookIndex = 0;
  let result = gen.next(undefined as unknown);

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as { type: symbol; [key: string]: unknown };
    const value = processOneDescriptor(
      descriptor,
      hookIndex++,
      hookStates,
      cleanupFns,
      pendingEffects,
      rerender,
      resume,
    );
    result = gen.next(value);
  }

  return {
    vnode: (result.value as Child) ?? null,
    gen: result.done ? null : gen,
  };
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/**
 * Compute the merged props for a VNode (includes children if any).
 */
function mergedProps(vnode: VNode): Record<string, unknown> {
  return vnode.children.length > 0 ? { ...vnode.props, children: vnode.children } : vnode.props;
}

/** Returns false only when the `$shown` prop is explicitly set to `false`. */
function isShown(props: Record<string, unknown>): boolean {
  return props['$shown'] !== false;
}

/**
 * Build DOM nodes from a list of VNodes and return them alongside Slot
 * tracking data.  Fragments are flattened into the parent list.
 */
function buildVNodeList(vnodes: Child[]): { nodes: Node[]; slots: Slot[] } {
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
      const genInstance = node instanceof HTMLElement ? (genInstanceMap.get(node) ?? null) : null;
      nodes.push(node);
      slots.push({ type: vnode.type, node, props: allProps, childSlots: [], genInstance });
      continue;
    }

    // HTML element
    const el = document.createElement(vnode.type as string);
    applyProps(el, vnode.props);
    const inner = buildVNodeList(vnode.children);
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

// ---------------------------------------------------------------------------
// Component mounting
// ---------------------------------------------------------------------------

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
function mountGeneratorComponent(fn: GeneratorComponentFn, props: Record<string, unknown>): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';

  const capturedCtx = _getCtxMap();
  const hookStates: unknown[] = [];
  const cleanupFns: ((() => void) | undefined)[] = [];
  const pendingEffects: Array<{ hookIndex: number; fn: () => (() => void) | void }> = [];

  // `instance` is fully populated below before any external code can observe it.
  // eslint-disable-next-line prefer-const
  let instance: GenInstance;

  /**
   * Called when the settled promise wants to show its result.
   * If the generator is still paused (waiting for the promise), resume it.
   * If the generator has already completed (e.g. due to a concurrent
   * state-change re-render), there is nothing to do.
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

    instance.slots = reconcileSlots(host, instance.slots, [vnode]);
    flushEffects(instance);
  }

  /**
   * Called by useState setters and external rerender requests.
   * Always performs a fresh generator run so that the component body
   * re-executes and picks up the latest state / props / context values.
   * Any currently-paused generator is discarded first.
   */
  function rerender(): void {
    const prevCtx = _getCtxMap();
    _setCtxMap(instance.capturedCtx);

    // Discard a paused generator so the fresh run starts from the top.
    instance.gen = null;
    instance.pendingEffects.length = 0;

    let vnode: Child;
    try {
      const gen = instance.fn(instance.props, rerender);
      const { vnode: v, gen: newGen } = runHooks(
        gen,
        instance.hookStates,
        instance.cleanupFns,
        instance.pendingEffects,
        rerender,
        resume,
      );
      instance.gen = newGen;
      vnode = v;
    } finally {
      _setCtxMap(prevCtx);
    }

    instance.slots = reconcileSlots(host, instance.slots, [vnode]);
    flushEffects(instance);
  }

  // ── Initial mount ──
  const prevCtx = _getCtxMap();
  _setCtxMap(capturedCtx);
  let initialVNode: Child;
  try {
    const gen = fn(props, rerender);
    const { vnode, gen: initialGen } = runHooks(
      gen,
      hookStates,
      cleanupFns,
      pendingEffects,
      rerender,
      resume,
    );
    initialVNode = vnode;
    const { nodes, slots } = buildVNodeList([initialVNode]);
    instance = {
      fn,
      gen: initialGen,
      props,
      host,
      capturedCtx,
      slots,
      hookStates,
      cleanupFns,
      pendingEffects,
    };
    genInstanceMap.set(host, instance);
    for (const n of nodes) host.appendChild(n);
  } finally {
    _setCtxMap(prevCtx);
  }
  flushEffects(instance);

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
function mountContextProvider(
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
function mountPlainComponent(fn: PlainComponentFn, props: Record<string, unknown>): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';
  const vnode = fn(props);
  if (vnode != null) host.appendChild(buildNode(vnode));
  return host;
}

// ---------------------------------------------------------------------------
// Reconciler
// ---------------------------------------------------------------------------

/**
 * Reconcile the DOM children of `parent` against a new list of VNodes.
 *
 * Children are matched by position.  For each position:
 *  - Same type + same props (shallow equal) → keep existing DOM node unchanged
 *  - Same type + changed props → update in place (elements) or remount (components)
 *  - Different type → replace
 *
 * Returns the updated slot array.
 */
function reconcileSlots(parent: HTMLElement, prevSlots: Slot[], nextVNodes: Child[]): Slot[] {
  // Flatten fragments before reconciling
  const flatNext = flattenChildren(nextVNodes);
  const nextSlots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const prevSlot = prevSlots[i] ?? null;
    const { slot, node, replaced } = reconcileOne(prevSlot, flatNext[i]);
    nextSlots.push(slot);

    if (replaced) {
      if (prevSlot) unmountSlot(prevSlot);
      if (prevSlot && prevSlot.node.parentNode === parent) {
        parent.replaceChild(node, prevSlot.node);
      } else {
        // Insertion point: before the (i+1)-th existing child
        const ref = parent.childNodes[i] ?? null;
        if (ref) {
          parent.insertBefore(node, ref);
        } else {
          parent.appendChild(node);
        }
      }
    }
    // If not replaced, the existing node is already in the correct place.
  }

  // Remove any extra old DOM nodes
  for (let i = flatNext.length; i < prevSlots.length; i++) {
    const old = prevSlots[i];
    unmountSlot(old);
    if (old.node.parentNode === parent) {
      parent.removeChild(old.node);
    }
  }

  return nextSlots;
}

/**
 * Reconcile a single child slot against a new VNode.
 *
 * Returns:
 *  - `slot`    – the updated (or new) Slot object
 *  - `node`    – the real DOM node for this slot
 *  - `replaced` – true if the DOM node changed and needs to be swapped in
 */
function reconcileOne(
  prevSlot: Slot | null,
  nextChild: Child,
): { slot: Slot; node: Node; replaced: boolean } {
  // ---- Empty / null ----
  if (nextChild == null || nextChild === false) {
    if (prevSlot?.type === 'empty') {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode('');
    return {
      slot: { type: 'empty', node, props: {}, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  // ---- Primitive (text / number) ----
  if (typeof nextChild === 'string' || typeof nextChild === 'number') {
    const text = String(nextChild);
    if (prevSlot?.type === 'text' && prevSlot.node instanceof Text) {
      if (prevSlot.node.textContent !== text) {
        prevSlot.node.textContent = text;
        prevSlot.props = { text };
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode(text);
    return {
      slot: { type: 'text', node, props: { text }, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  const vnode = nextChild as VNode;

  // ---- $shown === false: unmount and render empty placeholder ----
  const allPropsForShown = mergedProps(vnode);
  if (!isShown(allPropsForShown)) {
    if (prevSlot?.type === 'empty') {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode('');
    return {
      slot: { type: 'empty', node, props: {}, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  // ---- Function component ----
  if (typeof vnode.type === 'function') {
    const allProps = allPropsForShown;
    const fn = vnode.type as AnyComponentFn;
    const providerCtx = _getProviderCtx(fn);

    // Same component type at same position
    if (prevSlot?.type === vnode.type) {
      // Props unchanged → skip entirely (key memoization)
      if (shallowEqual(prevSlot.props, allProps)) {
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }

      // Context Provider whose value is unchanged but children differ → reconcile
      // children in-place.  This preserves child component state (hook states,
      // generator cursors) across parent re-renders when only the rendered
      // subtree changes, not the context value itself.
      //
      // If the value DID change we fall through to the full remount so that
      // already-mounted descendants pick up the new context (their capturedCtx
      // is refreshed via the remount).
      if (providerCtx && Object.is(prevSlot.props['value'], allProps['value'])) {
        const prevCtxMap = _getCtxMap();
        const newCtxMap = new Map(prevCtxMap);
        newCtxMap.set(providerCtx as never, allProps.value as unknown);
        _setCtxMap(newCtxMap);
        try {
          const childVNode = (fn as PlainComponentFn)(allProps);
          if (childVNode != null) {
            prevSlot.childSlots = reconcileSlots(
              prevSlot.node as HTMLElement,
              prevSlot.childSlots,
              [childVNode],
            );
          }
        } finally {
          _setCtxMap(prevCtxMap);
        }
        prevSlot.props = allProps;
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }

      // Other component types (or Provider whose value changed) → remount from scratch.
    }

    // Mount fresh component
    if (providerCtx) {
      const { node, childSlots } = mountContextProvider(
        fn as PlainComponentFn,
        allProps,
        providerCtx,
      );
      return {
        slot: { type: vnode.type, node, props: allProps, childSlots, genInstance: null },
        node,
        replaced: true,
      };
    }
    let node: Node;
    if (isGeneratorFn(fn)) {
      node = mountGeneratorComponent(fn, allProps);
    } else {
      node = mountPlainComponent(fn as PlainComponentFn, allProps);
    }
    const genInstance = node instanceof HTMLElement ? (genInstanceMap.get(node) ?? null) : null;
    return {
      slot: { type: vnode.type, node, props: allProps, childSlots: [], genInstance },
      node,
      replaced: true,
    };
  }

  // ---- HTML element ----
  if (typeof vnode.type === 'string') {
    if (prevSlot?.type === vnode.type && prevSlot.node instanceof HTMLElement) {
      // Same tag → update props in place and reconcile children
      updateProps(prevSlot.node, prevSlot.props, vnode.props);
      prevSlot.childSlots = reconcileSlots(prevSlot.node, prevSlot.childSlots, vnode.children);
      prevSlot.props = vnode.props;
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // Different tag → build fresh
    const el = document.createElement(vnode.type);
    applyProps(el, vnode.props);
    const inner = buildVNodeList(vnode.children);
    for (const c of inner.nodes) el.appendChild(c);
    return {
      slot: {
        type: vnode.type,
        node: el,
        props: vnode.props,
        childSlots: inner.slots,
        genInstance: null,
      },
      node: el,
      replaced: true,
    };
  }

  // ---- Fragment or anything else: full rebuild ----
  const node = buildNode(nextChild);
  return {
    slot: { type: (vnode as VNode).type, node, props: {}, childSlots: [], genInstance: null },
    node,
    replaced: true,
  };
}

// ---------------------------------------------------------------------------
// Virtual DOM → real DOM  (public, used for initial mounts and in tests)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public render function
// ---------------------------------------------------------------------------

/**
 * Render a VNode into a real DOM container.
 *
 * Call this once to mount your application:
 *
 * @example
 * render(<App />, document.getElementById('root')!);
 */
export function render(vnode: VNode, container: Element): void {
  container.appendChild(buildNode(vnode));
}
