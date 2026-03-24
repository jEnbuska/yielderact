/**
 * mount.ts — DOM construction and component lifecycle.
 *
 * Handles:
 * 1. Building DOM nodes from VNode trees (`buildNode`).
 * 2. Mounting components (`mountComponent`) — creates an end-marker Comment
 *    node, the `ComponentInstance`, and binds lifecycle closures.
 * 3. Lifecycle functions (`resumeInstance`, `rerenderInstance`,
 *    `runComponentRender`, `executeRerender`, `commitOrDefer`)
 *    that drive component rendering and reconciliation.
 *
 * Components use end-marker Comment nodes as insertion anchors — no wrapper
 * `<span>` elements.
 */

import {
  _instanceBatch,
  _resolveCtxValue,
  _withBatch,
  BatchContext,
  type Context,
  PriorityContext,
} from "../context";
import { $USE_EFFECT } from "../hooks/descriptors";
import { type Child, type Component, Fragment, type InternalProps, Portal } from "../jsx";
import { drive, driveWithContext, getContextMap, type RenderGenerator, setContext } from "./driver";
import { InvalidChildError } from "./errors";
import { getPatchMode, isComponentNode, mergedProps, stripFrameworkDirectives } from "./helpers";
import { flushEffects, resumeGenerator, runHooks } from "./hooks-runtime";
import { isPatchActive } from "./patch-queue";
import { applyProps } from "./props";
import { reconcileSlotsGen } from "./reconciler";
import { scheduleUpdate } from "./scheduler";
import { _requireActiveCtx, _setActiveCtx } from "./state";
import type { ComponentInstance, RenderContext } from "./types";

/**
 * Build a single real DOM node from a VNode (or primitive).
 *
 * Handles null/boolean (empty TextNode), string/number (TextNode),
 * Fragment/Portal (DocumentFragment), components (via `mountComponent`),
 * and HTML elements.
 *
 * Returns a `DocumentFragment` for components (output nodes + endMarker).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode type dispatch with many branches
export function* buildNode(child: Child): RenderGenerator<Node> {
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

  if (child.type === Portal) {
    const portalContainer = child.props["$portalContainer"] as Element;
    for (const c of child.children) {
      portalContainer.appendChild(yield* driveWithContext(map, buildNode(c)));
    }
    return document.createComment("portal");
  }

  if (child.type === Fragment) {
    const frag = document.createDocumentFragment();
    for (const c of child.children) {
      frag.appendChild(yield* driveWithContext(map, buildNode(c)));
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
    el.appendChild(yield* driveWithContext(map, buildNode(c)));
  }
  return el;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Compute the effective context map for a component's children. */
function effectiveCtxMap(instance: ComponentInstance): ReadonlyMap<Context<unknown>, unknown> {
  const ownPatch = getPatchMode(instance.props);
  return ownPatch !== undefined ? _withBatch(instance.capturedCtx, ownPatch) : instance.capturedCtx;
}

// ── Standalone lifecycle functions ────────────────────────────────────────

/**
 * Commit or defer a VNode during a UI patch.
 *
 * When a patch is active and the component is not `$patch="live"`, stores
 * the VNode as `pendingVNode` and runs a live-only reconcile pass.
 * Otherwise commits immediately and flushes effects.
 */
function* commitOrDefer(instance: ComponentInstance, vnode: Child): RenderGenerator<void> {
  const rctx = instance.renderCtx;
  const parent = instance.endMarker.parentNode as HTMLElement;
  const ctxMap = effectiveCtxMap(instance);
  const effectiveBatch = getPatchMode(instance.props) ?? _instanceBatch(instance.capturedCtx);
  const shouldDefer =
    (rctx.patchDepth > 0 || instance.localPatchRefCount > 0) && effectiveBatch !== "live";

  if (shouldDefer) {
    instance.pendingVNode = vnode;
    rctx.dirtyInstances.add(instance);
  } else {
    instance.pendingVNode = undefined;
  }

  const prevLiveOnly = rctx.liveOnlyMode;
  if (shouldDefer) rctx.liveOnlyMode = true;
  instance.slots = yield* driveWithContext(
    ctxMap,
    reconcileSlotsGen(parent, instance.slots, [vnode], instance.endMarker),
  );
  rctx.liveOnlyMode = prevLiveOnly;

  if (!shouldDefer) flushEffects(instance);
}

/**
 * Resume a paused generator (e.g. after `useResolve` or `useRender`).
 *
 * Advances the generator past the resolved hook and reconciles the
 * resulting VNode via `commitOrDefer`.
 */
function resumeInstance(instance: ComponentInstance): void {
  if (!instance.gen) return;
  if (!instance.endMarker.parentNode) return;
  _setActiveCtx(instance.renderCtx);

  const ctxMap = effectiveCtxMap(instance);
  const { vnode } = resumeGenerator(instance, instance.rerender, instance._resume, ctxMap);
  drive(ctxMap, commitOrDefer(instance, vnode));
}

/**
 * Run the component generator through hooks, handling mid-render retries.
 *
 * Returns the produced VNode and effective context map. Does NOT commit
 * or reconcile — the caller decides what to do with the output.
 */
function runComponentRender(instance: ComponentInstance): {
  vnode: Child;
  ctxMap: ReadonlyMap<Context<unknown>, unknown>;
} {
  const rctx = instance.renderCtx;

  while (true) {
    instance.isRendering = true;
    instance.gen = undefined;
    instance.pendingEffects.length = 0;
    instance.consumedContexts.clear();
    instance.providedContexts.clear();

    const ctxMap = effectiveCtxMap(instance);

    let vnode: Child;
    let cancelled = false;
    const prevRenderingPriority = rctx.renderingPriority;
    rctx.renderingPriority = instance.priority;
    try {
      const gen = instance.component(instance.props, instance.rerender);
      const result = runHooks(gen, instance, instance.rerender, instance._resume, ctxMap);
      instance.gen = result.gen;
      vnode = result.vnode;
      cancelled = result.cancelled;
    } finally {
      instance.isRendering = false;
      rctx.renderingPriority = prevRenderingPriority;
    }

    if (!cancelled) {
      // Recompute — useSetContext may have updated capturedCtx during hooks.
      return { vnode, ctxMap: effectiveCtxMap(instance) };
    }

    // Cancelled: mid-render setState detected. Revert effect deps and retry.
    for (const pe of instance.pendingEffects) {
      const state = instance.hookStates[pe.hookIndex];
      if (state !== undefined && state.kind === $USE_EFFECT) {
        state.deps = [];
      }
    }
    instance.pendingRerender = false;
  }
}

/**
 * Execute a full render cycle as a generator, handling initial mount,
 * rerenders, follow-up rerenders, and mid-render retries.
 */
function* executeRerender(
  instance: ComponentInstance,
  initiallyMounted: boolean,
): RenderGenerator<DocumentFragment> {
  const rctx = instance.renderCtx;
  let mounted = initiallyMounted;
  let initialFragment = document.createDocumentFragment();

  while (true) {
    const { vnode, ctxMap } = runComponentRender(instance);

    if (!mounted) {
      initialFragment = document.createDocumentFragment();
      initialFragment.appendChild(instance.endMarker);
      const prevLiveOnly = rctx.liveOnlyMode;
      rctx.liveOnlyMode = false;
      instance.slots = yield* driveWithContext(
        ctxMap,
        reconcileSlotsGen(initialFragment, [], [vnode], instance.endMarker),
      );
      rctx.liveOnlyMode = prevLiveOnly;
      mounted = true;
      flushEffects(instance);
    } else {
      yield* commitOrDefer(instance, vnode);
    }

    const resolvers = instance.renderResolvers.splice(0);
    for (const resolve of resolvers) resolve();

    if (mounted && !instance.endMarker.parentNode) return initialFragment;
    if (instance.pendingRerender) {
      instance.pendingRerender = false;
      continue;
    }
    return initialFragment;
  }
}

/**
 * Trigger a re-render of this component.
 *
 * If a render is already in progress, queues the rerender for after the
 * current cycle. If a UI patch is active, executes synchronously to
 * collect DOM ops in the same batch. Otherwise, schedules via the
 * priority-aware scheduler.
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
    drive(effectiveCtxMap(instance), executeRerender(instance, true));
    return Promise.resolve();
  }
  // Outside a render phase (event handler, timer, async callback, etc.)
  // — schedule through the priority-aware scheduler.
  scheduleUpdate(instance);
  return Promise.resolve();
}

// ── mountComponent ─────────────────────────────────────────────────────────

/**
 * Mount a component: create the `ComponentInstance`, bind lifecycle
 * closures, and run the initial render.
 *
 * Returns a `DocumentFragment` containing the output nodes and the
 * instance for slot tracking.
 */
export function* mountComponent(
  component: Component,
  props: InternalProps,
): RenderGenerator<{ fragment: DocumentFragment; componentInstance: ComponentInstance }> {
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
  instance._executeRerender = () => {
    _setActiveCtx(instance.renderCtx);
    drive(effectiveCtxMap(instance), executeRerender(instance, true));
    return Promise.resolve();
  };
  instance.rerender = () => rerenderInstance(instance);

  const fragment = yield* executeRerender(instance, false /* not yet mounted */);

  return { fragment, componentInstance: instance };
}
