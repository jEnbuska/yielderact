import type { ComponentInstance, UIPatchHookState } from "../render/types";
import { $USE_UI_PATCH, type UIPatchDescriptor } from "./descriptors";
import type { ComponentGenerator } from "./types";

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
 * function* PageComponent() {
 *   const [page, setPage] = yield* useState('home');
 *   const startPatch = yield* useUIPatch();
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
export function* useUIPatch(): ComponentGenerator<() => () => void> {
  const desc: UIPatchDescriptor = { type: $USE_UI_PATCH };
  const startPatch = yield desc;
  return startPatch as () => () => void;
}

/** @internal */
export function _processUIPatch(
  prev: UIPatchHookState | undefined,
  instance: ComponentInstance,
  collectDescendants: (instance: ComponentInstance) => ComponentInstance[],
  flushPendingVNodes: (instances: ComponentInstance[]) => void,
): UIPatchHookState {
  if (prev !== undefined) return prev;
  const startPatch = (): (() => void) => {
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
  return { kind: $USE_UI_PATCH, startPatch };
}
