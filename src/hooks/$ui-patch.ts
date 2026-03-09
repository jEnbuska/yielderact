import { $UI_PATCH, type HookContext } from './symbols';

/**
 * Returns a stable `startPatch` function that begins a **local** UI patch
 * scoped to the calling component and its current descendants.
 *
 * Calling `startPatch()` snapshots the subtree at that moment, increments the
 * `localPatchRefCount` on every instance in the snapshot, and returns a
 * `commit` function.  Until `commit()` is called, DOM updates for those
 * instances are deferred — their generators still run and state updates are
 * applied, but `reconcileSlots` is not called.
 *
 * When `commit()` is called, all pending VNodes are flushed to the DOM at
 * once.  Components marked `$patch="live"` are never deferred regardless of
 * any active patch.
 *
 * For a tree-wide patch use `startUIPatch` / `commitUIPatch` instead.
 *
 * Must be called with `yield*` inside a generator component.
 *
 * @example
 * function* PageComponent(_props: object) {
 *   const [page, setPage] = yield* $state('home');
 *   const startPatch = yield* $uiPatch();
 *
 *   const navigate = async (next: string) => {
 *     const commit = startPatch();
 *     try {
 *       const data = await fetchPageData(next);
 *       setPageData(data);
 *       setPage(next);
 *     } finally {
 *       commit();
 *     }
 *   };
 *
 *   return <main>...</main>;
 * }
 */
export function* $uiPatch(): Generator<unknown, () => () => void, unknown> {
  const startPatch = yield { type: $UI_PATCH };
  return startPatch as () => () => void;
}

/** @internal */
export function _processUIPatch(ctx: HookContext): unknown {
  const { hookIndex, hookStates, instance, collectDescendants, flushPendingVNodes } = ctx;
  if (!(hookIndex in hookStates)) {
    hookStates[hookIndex] = (): (() => void) => {
      const snapshot = collectDescendants(instance);

      instance.localPatchRefCount++;
      for (const inst of snapshot) inst.localPatchRefCount++;

      return (): void => {
        instance.localPatchRefCount = Math.max(0, instance.localPatchRefCount - 1);
        for (const inst of snapshot) {
          inst.localPatchRefCount = Math.max(0, inst.localPatchRefCount - 1);
        }
        flushPendingVNodes([instance, ...snapshot]);
      };
    };
  }
  return hookStates[hookIndex];
}
