import { type GenInstance } from './types';

/**
 * Shared mutable render state.  All render modules read and write properties
 * on this object instead of module-level `let` variables so that the values
 * are visible across the ES-module boundary without re-exporting reassignable
 * bindings (which ES modules do not support across files).
 */
export const renderState = {
  /** Map from a generator component's host span to its instance. */
  genInstanceMap: new WeakMap<HTMLElement, GenInstance>(),

  /** Reference-counted global patch depth. DOM writes deferred while > 0. */
  patchDepth: 0,

  /**
   * Currently inherited `$patch` behaviour propagated down during rendering.
   * Maintained as a save/restore stack (same pattern as `_ctxMap`).
   * Root starts as `'default'`.
   */
  currentBatchBehavior: 'default' as 'live' | 'default',

  /**
   * When true, `reconcileOne` skips DOM updates for `$patch="default"` components
   * and skips `updateProps` on HTML elements — only `$patch="live"` subtrees are
   * reconciled.  Used to flush live descendants while a parent is frozen.
   */
  liveOnlyMode: false,

  /** Global-patch dirty set: instances with a `pendingVNode` awaiting `commitUIPatch`. */
  dirtyInstances: new Set<GenInstance>(),

  /** Counter for stable unique IDs produced by `useId`. */
  idCounter: 0,
};
