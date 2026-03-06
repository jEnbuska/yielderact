import { type VNode, type Child, type GeneratorComponentFn } from '../jsx';
import { type Context } from '../context';

/**
 * A "slot" tracks one reconciled position in the rendered DOM tree.
 * It records the type that was rendered, the DOM node, and (for components)
 * the running generator instance.
 */
export interface Slot {
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
export interface GenInstance {
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
  /**
   * The context map that was active when this component last rendered.
   * Updated by `propagateContextUpdate` when an ancestor Provider value changes.
   */
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>;
  /**
   * Set of contexts consumed during the last render pass (populated by `useContext`).
   * Cleared at the start of each re-render so it only reflects the current render.
   */
  consumedContexts: Set<Context<unknown>>;
  /** Re-runs this component's generator body with current props and `capturedCtx`. */
  rerender: () => void;
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
  /**
   * Effective `$patch` behaviour for this component.
   * Resolved from the component's own `$patch` prop (if any) falling back to
   * the nearest ancestor's inherited value.  Defaults to `'default'`.
   */
  batchBehavior: 'live' | 'default';
  /**
   * VNode computed during an active UI patch that has not yet been reconciled
   * to the DOM.  `undefined` when no deferred update is pending.
   */
  pendingVNode: Child | undefined;
  /**
   * Number of active local patches (`useUIPatch`) whose snapshot includes this
   * instance.  > 0 means this instance's DOM writes are deferred by a local patch.
   */
  localPatchRefCount: number;
}
