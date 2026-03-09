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
   * **Incremented by:** `processOneDescriptor($ID)` in `hooks-runtime.ts`.
   * Each `useId()` call gets `":r<N>:"` where N is the counter value at
   * first mount. The ID is stored in `hookStates` and reused on rerenders.
   */
  idCounter: 0,

  /**
   * The priority level of the component currently being rendered, or `null`
   * when no render is in progress.
   *
   * Used to determine the priority of `setState` calls during render:
   * if component B (priority 2) calls setState on component A (priority 0)
   * during B's render, the update is assigned priority 2 (the caller's).
   *
   * **Set by:** `executeRerender` in `mount.ts` — before calling `runHooks`.
   * **Cleared by:** `executeRerender` — in the `finally` block.
   * **Read by:** `processOneDescriptor($STATE)` — to tag the setState
   *   call with the correct priority.
   */
  renderingPriority: null as number | null,

  /**
   * True while performing the initial mount (before the root tree is
   * attached to the live DOM).
   *
   * During initial mount, priority levels do not apply — the full tree
   * mounts as a single patch. This flag prevents `$deferred` from splitting
   * work into multiple priority passes during the first render.
   *
   * **Set by:** `render()` / `createRoot().render()` in `index.ts`.
   * **Read by:** the scheduler — to skip priority splitting during mount.
   */
  isInitialMount: false,
};
