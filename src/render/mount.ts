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

import { BatchContext, type Context, PriorityContext, withBatch } from "../context";
import type { HookDescriptor } from "../hooks/descriptors";
import { $USE_EFFECT, $USE_SET_CONTEXT } from "../hooks/descriptors";
import { type Child, type Component, type InternalProps, Portal, RawFragment } from "../jsx";
import {
  drive,
  driveWithContext,
  getContext,
  getContextMap,
  type RenderGenerator,
  setContext,
} from "./driver";
import { InvalidChildError } from "./errors";
import { isComponentNode, mergedProps, stripFrameworkDirectives } from "./helpers";
import { flushEffects, isHookDescriptor, processOneDescriptor } from "./hooks-runtime";
import { isPatchActive } from "./patch-queue";
import { createResolvable } from "./promise";
import { applyProps } from "./props";
import { reconcileSlotsGen } from "./reconciler";
import { scheduleUpdate } from "./scheduler";
import { RenderCtx } from "./state";
import type { ComponentInstance } from "./types";

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
  const { $shown, $patch, $deferred, $context } = child.props;
  if ($shown === false) return document.createTextNode("");
  if ($patch) yield* setContext(BatchContext, () => $patch);
  if ($deferred) yield* setContext(PriorityContext, (current) => current + 1);
  if ($context) {
    const entries = Array.isArray($context) ? $context : [$context];
    for (const entry of entries) {
      yield* setContext(entry.ctx, () => entry.value);
    }
  }

  const effectiveProps = isComponentNode(child) ? mergedProps(child) : child.props;
  const map = yield* getContextMap();

  if (child.type === Portal) {
    const portalContainer = child.props["$portalContainer"] as Element;
    for (const c of child.children) {
      portalContainer.appendChild(yield* driveWithContext(map, buildNode(c)));
    }
    return document.createComment("portal");
  }

  if (child.type === RawFragment) {
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
  const { $patch } = instance.props;
  return $patch ? withBatch(instance.capturedCtx, $patch) : instance.capturedCtx;
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
  const rctx = yield* getContext(RenderCtx);
  const parent = instance.endMarker.parentNode as HTMLElement;
  const batch = yield* getContext(BatchContext);
  const ctxMap = yield* getContextMap();
  const shouldDefer = (rctx.patchDepth > 0 || instance.localPatchRefCount > 0) && batch !== "live";

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
function* resumeInstance(instance: ComponentInstance): RenderGenerator<void> {
  if (!instance.gen) return;
  if (!instance.endMarker.parentNode) return;

  const ctxMap = effectiveCtxMap(instance);
  const gen = instance.gen;
  let hookIndex = instance.resumeHookIndex;
  let result = gen.next();

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as HookDescriptor;
    const hookResult = processOneDescriptor(
      descriptor,
      hookIndex++,
      instance.hookStates,
      instance.cleanupFns,
      instance.pendingEffects,
      instance.rerender,
      instance._resume,
      instance,
      ctxMap,
    );
    // Sync driver's ctxMap when a context value is set via useSetContext
    if (descriptor.type === $USE_SET_CONTEXT) {
      const { ctx, value } = descriptor as { ctx: Context<unknown>; value: unknown };
      yield* setContext(ctx, () => value);
    }
    result = gen.next(hookResult);
  }

  instance.resumeHookIndex = hookIndex;
  if (result.done) {
    instance.gen = undefined;
    if (instance.finalHookCount !== undefined && hookIndex !== instance.finalHookCount) {
      const name = instance.component.name || "Anonymous";
      throw new Error(
        `Hook count mismatch in "${name}": previous ${instance.finalHookCount}, now ${hookIndex}.`,
      );
    }
    instance.finalHookCount = hookIndex;
  }

  const vnode: Child = (result.value as Child) ?? null;
  yield* commitOrDefer(instance, vnode);
}

/**
 * Execute a full render cycle as a generator.
 *
 * One loop handles: run hooks → check cancelled → commit/defer →
 * resolve promises → check pendingRerender → return or retry.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component lifecycle with retry and commit
function* executeRerender(
  instance: ComponentInstance,
  initiallyMounted: boolean,
): RenderGenerator<DocumentFragment> {
  const rctx = yield* getContext(RenderCtx);
  let mounted = initiallyMounted;
  let initialFragment = document.createDocumentFragment();

  while (true) {
    // ── Run component generator through hooks ──
    instance.isRendering = true;
    instance.gen = undefined;
    instance.pendingEffects.length = 0;
    instance.consumedContexts.clear();
    instance.providedContexts.clear();

    const ctxMap = effectiveCtxMap(instance);
    const componentGen = instance.component(instance.props, instance.rerender);
    let hookIndex = 0;
    let result = componentGen.next(undefined);
    let cancelled = false;

    const prevRenderingPriority = rctx.renderingPriority;
    rctx.renderingPriority = yield* getContext(PriorityContext);

    while (!result.done && isHookDescriptor(result.value)) {
      const descriptor = result.value as HookDescriptor;
      const hookResult = processOneDescriptor(
        descriptor,
        hookIndex++,
        instance.hookStates,
        instance.cleanupFns,
        instance.pendingEffects,
        instance.rerender,
        instance._resume,
        instance,
        ctxMap,
      );
      // Sync driver's ctxMap when a context value is set via useSetContext
      if (descriptor.type === $USE_SET_CONTEXT) {
        const { ctx, value } = descriptor as { ctx: Context<unknown>; value: unknown };
        yield* setContext(ctx, () => value);
      }
      if (instance.pendingRerender) {
        cancelled = true;
        break;
      }
      result = componentGen.next(hookResult);
    }

    instance.isRendering = false;
    rctx.renderingPriority = prevRenderingPriority;
    instance.resumeHookIndex = hookIndex;

    if (!cancelled && result.done) {
      if (instance.finalHookCount !== undefined && hookIndex !== instance.finalHookCount) {
        const name = instance.component.name || "Anonymous";
        throw new Error(
          `Hook count mismatch in "${name}": previous ${instance.finalHookCount}, now ${hookIndex}.`,
        );
      }
      instance.finalHookCount = hookIndex;
    }

    const vnode: Child = cancelled ? null : ((result.value as Child) ?? null);
    instance.gen = cancelled || result.done ? undefined : componentGen;

    // ── Mid-render setState → revert effect deps and retry ──
    if (cancelled) {
      for (const pe of instance.pendingEffects) {
        const state = instance.hookStates[pe.hookIndex];
        if (state !== undefined && state.kind === $USE_EFFECT) {
          state.deps = [];
        }
      }
      instance.pendingRerender = false;
      continue;
    }

    // ── Commit ──
    // Recompute ctxMap — useSetContext may have updated capturedCtx.
    const commitCtxMap = effectiveCtxMap(instance);
    if (!mounted) {
      initialFragment = document.createDocumentFragment();
      initialFragment.appendChild(instance.endMarker);
      const prevLiveOnly = rctx.liveOnlyMode;
      rctx.liveOnlyMode = false;
      instance.slots = yield* driveWithContext(
        commitCtxMap,
        reconcileSlotsGen(initialFragment, [], [vnode], instance.endMarker),
      );
      rctx.liveOnlyMode = prevLiveOnly;
      mounted = true;
      flushEffects(instance);
    } else {
      yield* commitOrDefer(instance, vnode);
    }

    // ── Resolve setState promises ──
    const resolvers = instance.renderResolvers.splice(0);
    for (const resolve of resolvers) resolve();

    // ── Follow-up rerender or return ──
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
    const { promise, resolve } = createResolvable<void>();
    instance.renderResolvers.push(resolve);
    return promise;
  }
  if (!instance.endMarker.parentNode) return Promise.resolve();
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

  const instance: ComponentInstance = {
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
  instance._resume = () => {
    drive(effectiveCtxMap(instance), resumeInstance(instance));
  };
  instance._executeRerender = () => {
    drive(effectiveCtxMap(instance), executeRerender(instance, true));
    return Promise.resolve();
  };
  instance.rerender = () => rerenderInstance(instance);

  const fragment = yield* executeRerender(instance, false /* not yet mounted */);

  return { fragment, componentInstance: instance };
}
