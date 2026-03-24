/**
 * mount.ts — Initial DOM construction and component lifecycle.
 *
 * This module handles:
 * 1. **Building** DOM nodes from VNode trees (`buildNode`).
 * 2. **Mounting** components (`mountComponent`) — creates
 *    an end-marker Comment node, the `ComponentInstance`, and binds
 *    `resumeInstance`, `executeRerender`, and `rerenderInstance` as the
 *    component's lifecycle drivers.
 * 3. Standalone lifecycle functions (`resumeInstance`, `executeRerender`,
 *    `rerenderInstance`, `commitOrDefer`) that operate on a
 *    `ComponentInstance` parameter instead of closing over local state.
 *
 * **No wrapper spans.** Components do not create wrapper `<span>` elements.
 * Instead, output nodes are placed directly in the parent DOM. Each component
 * and Provider uses an end-marker Comment node (`<!---->`) as an
 * insertion anchor and slot reference. The end-marker is always the last DOM
 * node belonging to the component within its parent.
 */

import {
  _instanceBatch,
  _resolveCtxValue,
  _withBatch,
  BatchContext,
  PriorityContext,
} from "../context";
import { $USE_EFFECT } from "../hooks/descriptors";
import { type Child, type Component, Fragment, type InternalProps, Portal } from "../jsx";
import { InvalidChildError } from "./errors";
import { getPatchMode, isComponentNode, mergedProps, stripFrameworkDirectives } from "./helpers";
import { flushEffects, resumeGenerator, runHooks } from "./hooks-runtime";
import { isPatchActive } from "./patch-queue";
import { applyProps } from "./props";
import { reconcileSlots } from "./reconciler";
import { scheduleUpdate } from "./scheduler";
import {
  _requireActiveCtx,
  _setActiveCtx,
  type ContextGenerator,
  getContextMap,
  runWithContext,
  setContext,
} from "./state";
import type { ComponentInstance, RenderContext } from "./types";

/**
 * Build a single real DOM node from a virtual DOM node (or primitive value).
 *
 * Unlike `buildVNodeList`, this returns a single Node and does not produce
 * Slot tracking data. Used for top-level renders and Fragment children.
 *
 * **Called by:**
 * - `render()` and `createRoot().render()` in `index.ts` — top-level mount.
 * - Itself (recursively) — for Fragment children and HTML element children.
 * - `reconcileOne` in `reconciler.ts` — fallback for unrecognized VNode types.
 *
 * **Handles:**
 * 1. `null` / `undefined` / `false` → empty TextNode.
 * 2. `string` / `number` → TextNode.
 * 3. `Fragment` → `DocumentFragment` containing children.
 * 4. Component → dispatches to `mountComponent`
 *    or `mountContextProvider`.
 * 5. HTML tag string → `HTMLElement` with props and children.
 *
 * @param child - The VNode or primitive to build.
 * @returns The real DOM node. For components and Providers, returns
 *   a `DocumentFragment` containing the output nodes + endMarker.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode type dispatch with many branches
export function* buildNode(child: Child): ContextGenerator<Node> {
  if (child == null || typeof child === "boolean") {
    return document.createTextNode("");
  }
  if (typeof child === "string" || typeof child === "number") {
    return document.createTextNode(String(child));
  }
  if (!child.type) {
    throw new InvalidChildError(child);
  }
  const { $shown, $patch, $deferred } = child.props;
  if ($shown === false) return document.createTextNode("");
  if ($patch) yield* setContext(BatchContext, () => $patch);
  if ($deferred) yield* setContext(PriorityContext, (current) => current + 1);

  const effectiveProps = isComponentNode(child) ? mergedProps(child) : child.props;
  const map = yield* getContextMap();

  if (child.type === Fragment || child.type === Portal) {
    if (child.type === Portal) {
      const portalContainer = child.props["$portalContainer"] as Element;
      for (const c of child.children) {
        portalContainer.appendChild(runWithContext(map, buildNode(c)));
      }
      return document.createComment("portal");
    }
    const frag = document.createDocumentFragment();
    for (const c of child.children) {
      frag.appendChild(runWithContext(map, buildNode(c)));
    }
    return frag;
  }

  if (isComponentNode(child)) {
    const allProps = stripFrameworkDirectives(effectiveProps);
    return (yield* mountComponent(child.type, allProps)).fragment;
  }

  // HTML element
  const el = document.createElement(child.type as string);
  applyProps(el, child.props);
  for (const c of child.children) {
    el.appendChild(runWithContext(map, buildNode(c)));
  }
  return el;
}

// ── Standalone lifecycle functions ────────────────────────────────────────

/**
 * Decide whether to commit a VNode immediately or defer it during a UI patch.
 *
 * When a global or local patch is active and the component is not `$patch="live"`,
 * the VNode is stored as `pendingVNode` and a live-only reconcile pass updates
 * only `$patch="live"` descendants. Otherwise, the VNode is committed immediately
 * via `reconcileSlots` and effects are flushed.
 *
 * **Called by:** `resumeInstance` and `executeRerender`.
 */
function commitOrDefer(instance: ComponentInstance, vnode: Child): void {
  const rctx = instance.renderCtx;
  const parent = instance.endMarker.parentNode as HTMLElement;
  const ownPatch = getPatchMode(instance.props);
  const ctxMap =
    ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx;
  const effectiveBatch = ownPatch ?? _instanceBatch(instance.capturedCtx);
  const shouldDefer =
    (rctx.patchDepth > 0 || instance.localPatchRefCount > 0) && effectiveBatch !== "live";
  if (shouldDefer) {
    instance.pendingVNode = vnode;
    rctx.dirtyInstances.add(instance);
    const prevLiveOnly = rctx.liveOnlyMode;
    rctx.liveOnlyMode = true;
    try {
      instance.slots = reconcileSlots(parent, instance.slots, [vnode], instance.endMarker, ctxMap);
    } finally {
      rctx.liveOnlyMode = prevLiveOnly;
    }
  } else {
    instance.pendingVNode = undefined;
    instance.slots = reconcileSlots(parent, instance.slots, [vnode], instance.endMarker, ctxMap);
    flushEffects(instance);
  }
}

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
 *   but `resumeInstance` is for mid-generator continuation specifically).
 */
function resumeInstance(instance: ComponentInstance): void {
  if (!instance.gen) return;
  if (!instance.endMarker.parentNode) return;
  _setActiveCtx(instance.renderCtx);

  // Compute effective context: inherited context + own $patch applied for children.
  const ownPatchResume = getPatchMode(instance.props);
  const effectiveCtxMap =
    ownPatchResume !== undefined
      ? _withBatch(instance.capturedCtx, ownPatchResume)
      : instance.capturedCtx;

  const { vnode } = resumeGenerator(instance, instance.rerender, instance._resume, effectiveCtxMap);

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
 * 5. Create a fresh generator: `instance.component(instance.props, rerender)`.
 * 6. Run `runHooks(gen, …)` — processes hook descriptors, returns VNode.
 * 7. Set `isRendering = false`.
 * 8. If cancelled (mid-render setState detected) → revert effect deps, retry.
 * 9. If not cancelled → commit the VNode:
 *    - Initial mount: `reconcileSlots` into the returned fragment.
 *    - Rerender: `commitOrDefer` for reconciliation in place.
 * 10. Resolve any `renderResolvers` (awaited setState promises).
 * 11. If `pendingRerender` is set → loop again for follow-up rerender.
 *
 * **Called by:**
 * - `mountComponent` — for the initial mount (returns the fragment).
 * - `rerenderInstance` — for all subsequent re-renders.
 * - `instance._executeRerender` — called by the scheduler.
 *
 * @param instance - The component instance to render.
 * @param initiallyMounted - `false` on initial mount, `true` on rerenders.
 * @param endMarker - The end-marker Comment node (needed for initial fragment assembly).
 * @returns An object with `promise` (resolves when done) and `fragment`
 *   (the initial mount fragment, only meaningful when `initiallyMounted=false`).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: generator lifecycle with retry, defer, and reconciliation
function executeRerender(
  instance: ComponentInstance,
  initiallyMounted: boolean,
): { promise: Promise<void>; fragment: DocumentFragment } {
  const rctx = instance.renderCtx;
  let mounted = initiallyMounted;
  let initialFragment = document.createDocumentFragment();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    instance.isRendering = true;
    // Discard any paused generator; the fresh run starts from the top.
    instance.gen = undefined;
    instance.pendingEffects.length = 0;

    // Reset consumed-context tracking so the new render records a fresh set.
    instance.consumedContexts.clear();
    instance.providedContexts.clear();

    // Compute effective context: inherited context + own $patch for children.
    const ownPatch = getPatchMode(instance.props);
    let effectiveCtxMap =
      ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx;

    let vnode: Child;
    let cancelled = false;
    const prevRenderingPriority = rctx.renderingPriority;
    rctx.renderingPriority = instance.priority;
    try {
      const gen = instance.component(instance.props, instance.rerender);
      const result = runHooks(gen, instance, instance.rerender, instance._resume, effectiveCtxMap);
      instance.gen = result.gen;
      vnode = result.vnode;
      cancelled = result.cancelled;
    } finally {
      instance.isRendering = false;
      rctx.renderingPriority = prevRenderingPriority;
    }

    // Recompute effective context — useSetContext may have updated capturedCtx.
    effectiveCtxMap =
      ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx;

    if (cancelled) {
      // Revert deps for effects queued during this cancelled render so the
      // retry re-queues them (their deps in hookStates already match).
      for (const pe of instance.pendingEffects) {
        const state = instance.hookStates[pe.hookIndex];
        if (state !== undefined && state.kind === $USE_EFFECT) {
          state.deps = [];
        }
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
      initialFragment.appendChild(instance.endMarker);
      const prevLiveOnly = rctx.liveOnlyMode;
      rctx.liveOnlyMode = false;
      instance.slots = reconcileSlots(
        initialFragment,
        [],
        [vnode],
        instance.endMarker,
        effectiveCtxMap,
      );
      rctx.liveOnlyMode = prevLiveOnly;
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
    // Guard against zombie rerenders: if the component was unmounted during
    // this render cycle (e.g. by an effect), bail out.
    if (mounted && !instance.endMarker.parentNode) {
      return { promise: Promise.resolve(), fragment: initialFragment };
    }
    if (instance.pendingRerender) {
      instance.pendingRerender = false;
      continue;
    }

    return { promise: Promise.resolve(), fragment: initialFragment };
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
 * **Otherwise:** `executeRerender(instance, true)` is called immediately.
 *
 * **Called by:**
 * - `useState` setters — via the setter function returned by
 *   `processOneDescriptor($USE_STATE)`.
 * - `reconcileOne` in `reconciler.ts` — when the parent passes new
 *   props, or a consumed context value changed.
 * - `propagateContextUpdate` in `hooks-runtime.ts` — when an ancestor
 *   Provider value changes and this instance consumes the context.
 * - `useResolveRaw`'s `.then()` handler — when a tracked promise settles.
 *
 * @returns A Promise that resolves after the rerender is committed.
 */
function rerenderInstance(instance: ComponentInstance): Promise<void> {
  if (instance.isRendering) {
    instance.pendingRerender = true;
    return new Promise<void>((resolve) => {
      instance.renderResolvers.push(resolve);
    });
  }
  if (!instance.endMarker.parentNode) return Promise.resolve();
  _setActiveCtx(instance.renderCtx);
  if (isPatchActive()) {
    // During an active patch (another component is rendering or a
    // $patch batch is in progress), execute synchronously so the DOM
    // ops are collected into the same patch queue.
    return executeRerender(instance, true /* already mounted */).promise;
  }
  // Outside a render phase (event handler, timer, async callback, etc.)
  // — schedule through the priority-aware scheduler.
  scheduleUpdate(instance);
  return Promise.resolve();
}

// ── mountComponent ─────────────────────────────────────────────────────────

/**
 * Mount a component using an end-marker Comment node.
 *
 * Creates the `ComponentInstance` with all mutable state arrays, binds the
 * standalone lifecycle functions (`resumeInstance`, `executeRerender`,
 * `rerenderInstance`) to the instance, and runs the initial render.
 *
 * **Called by:**
 * - `buildVNodeList` and `buildNode` — during initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a new component appears
 *   at a position where a different type was before.
 *
 * @param component - The component function.
 * @param props     - The component's initial props.
 * @returns `{ fragment, componentInstance }` — the fragment to insert into the DOM
 *   and the instance for slot tracking.
 */
export function* mountComponent(
  component: Component,
  props: InternalProps,
): ContextGenerator<{ fragment: DocumentFragment; componentInstance: ComponentInstance }> {
  const ctxMap = yield* getContextMap();

  /** The per-root render context, captured from the active context at mount time. */
  const rctx: RenderContext = _requireActiveCtx();

  const instance: ComponentInstance = {
    renderCtx: rctx,
    component,
    props,
    endMarker: document.createComment(""),
    capturedCtx: ctxMap,
    slots: [],
    hookStates: [],
    cleanupFns: [],
    pendingEffects: [],
    localPatchRefCount: 0,
    isRendering: false,
    pendingRerender: false,
    renderResolvers: [],
    priority: _resolveCtxValue(ctxMap, PriorityContext),
    resumeHookIndex: 0,
    consumedContexts: new Set(),
    providedContexts: new Set(),
    // Bound lifecycle functions — each delegates to the standalone function.
    _resume: undefined as unknown as () => void,
    _executeRerender: undefined as unknown as () => Promise<void>,
    rerender: undefined as unknown as () => Promise<void>,
  };

  // Bind lifecycle functions after instance is created so they can close
  // over the instance reference. These are simple one-line wrappers.
  instance._resume = () => resumeInstance(instance);
  instance._executeRerender = () => executeRerender(instance, true).promise;
  instance.rerender = () => rerenderInstance(instance);

  const { fragment } = executeRerender(instance, false /* not yet mounted */);

  return { fragment, componentInstance: instance };
}
