import { type GenInstance } from './types';

/**
 * Shared mutable render state.
 *
 * All render modules read and write properties on this single object instead
 * of module-level `let` variables.  This is necessary because ES modules
 * cannot re-export reassignable bindings across files — a mutable object
 * with properties is the simplest way to share state.
 */
export const renderState = {
  /**
   * Maps a generator component's host `<span>` to its `GenInstance`.
   *
   * **Written by:** `mountGeneratorComponent` — registers the instance
   *   after creating it.
   * **Read by:** `reconcileOne` and `buildVNodeList` — after mounting a
   *   component, looks up the instance from the returned host node so it
   *   can be stored in `Slot.genInstance`.
   *
   * Uses a `WeakMap` so that unmounted components are garbage-collected
   * when their host span is no longer referenced.
   */
  genInstanceMap: new WeakMap<HTMLElement, GenInstance>(),

  /**
   * Reference-counted global patch depth.
   *
   * While > 0, all `$patch="default"` components defer their DOM writes
   * (store a `pendingVNode` instead of calling `reconcileSlots` normally).
   *
   * **Incremented by:** `startUIPatch()` in `patch.ts`.
   * **Decremented by:** `commitUIPatch()` in `patch.ts`.
   * **Read by:** `executeRerender` and `resume` in `mount.ts` — part of
   *   the `shouldDefer` check:
   *   `(patchDepth > 0 || localPatchRefCount > 0) && effectiveBatch !== 'live'`.
   */
  patchDepth: 0,

  /**
   * When true, `reconcileOne` only updates `$patch="live"` subtrees and
   * skips everything else (text updates, prop updates, component rerenders,
   * structural changes).
   *
   * This mode is activated temporarily by `executeRerender` and `resume`
   * when a component needs to defer its own DOM writes (`shouldDefer`)
   * but still must flush its `$patch="live"` descendants immediately.
   * The pattern is:
   * ```
   *   liveOnlyMode = true;
   *   reconcileSlots(host, slots, [vnode]);  // only live subtrees touched
   *   liveOnlyMode = false;
   * ```
   *
   * **Set to `true` by:** `executeRerender` / `resume` in `mount.ts`.
   * **Restored by:** the same functions in a `finally` block.
   * **Read by:** `reconcileOne` in `reconciler.ts` — guards every section
   *   (null, text, $shown, function component, HTML element).
   */
  liveOnlyMode: false,

  /**
   * Set of `GenInstance`s that have a `pendingVNode` waiting to be committed.
   *
   * When a global patch is active (`patchDepth > 0`), deferred components
   * add themselves here. When `commitUIPatch()` runs, it drains this set
   * and calls `_flushPendingVNodes` to reconcile all pending VNodes.
   *
   * **Added to by:** `executeRerender` / `resume` when `shouldDefer` is true.
   * **Drained by:** `commitUIPatch()` in `patch.ts`.
   * **Deleted from by:** `unmountSlot` — removes unmounted instances so
   *   `commitUIPatch` doesn't try to reconcile a dead component.
   */
  dirtyInstances: new Set<GenInstance>(),

  /**
   * Auto-incrementing counter for stable unique IDs produced by `useId`.
   *
   * **Incremented by:** `processOneDescriptor(USE_ID)` in `hooks-runtime.ts`.
   * Each `useId()` call gets `":r<N>:"` where N is the counter value at
   * first mount. The ID is stored in `hookStates` and reused on rerenders.
   */
  idCounter: 0,
};
