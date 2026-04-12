/**
 * BaseInstance — shared lifecycle for ComponentInstance and ContextInstance.
 *
 * Each instance represents one mounted component or context provider in the
 * render tree. Every instance receives its parent's ContextMap as the `ctx`
 * constructor argument. Component instances simply store it; context
 * instances extend it with their own handle before calling `super`.
 *
 * Render scheduling is reason-based: callers pass an optional `reason`
 * symbol to `scheduleRender`. The instance only actually leaves the
 * scheduler queue when all of its render reasons have been cleared — either
 * by `unscheduleRender(reason)` (e.g. a context subscriber deciding the
 * change was irrelevant) or by the render actually executing. The scheduler
 * itself doesn't know about reasons; it just sees `schedule` / `unschedule`.
 *
 * Cleanup is split into small helpers so `unmount()` reads as a sequence of
 * responsibilities rather than one long block.
 */

import type { ContextHandle } from "../context";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import type { ComponentGenerator } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { Child, VNode, VNodeProps, VNodeType } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { Slot, SlotKey } from "../render/slots";
import type { ContextMap, HookState, RenderContext } from "../render/types";

const DEFAULT_SCHEDULE_REASON = Symbol("default");

export abstract class BaseInstance<TVNodeType extends VNodeType = VNodeType> {
  readonly vnode: VNode<TVNodeType>;
  readonly index: number;
  readonly path: readonly number[];
  readonly parent: BaseInstance | null;
  /**
   * ContextMap this instance exposes to its children and reads for its own
   * `context` hooks. ComponentInstance keeps the parent map unchanged;
   * ContextInstance extends it with its own handle before calling `super`.
   */
  readonly ctx: ContextMap;
  readonly rctx: RenderContext;
  readonly children: BaseInstance[] = [];
  slots: Slot[] = [];
  keyIndex: Map<SlotKey, number> = new Map();
  hookStates: HookState[] = [];
  props: VNodeProps;
  pendingProps: VNodeProps | null = null;
  gen: ComponentGenerator<Child> | null = null;
  unmounted = false;

  /** Active schedule reasons. Empty Set ⇒ instance is not in the queue. */
  readonly renderReasons: Set<symbol> = new Set();

  /**
   * DOM anchor pair delimiting this instance's subtree. Everything between
   * `startAnchor.nextSibling` and `endAnchor` belongs to this instance.
   * The reconciler moves/inserts/removes the instance by walking this range.
   */
  readonly startAnchor: Comment;
  readonly endAnchor: Comment = document.createComment("/");

  constructor(
    vnode: VNode<TVNodeType>,
    ctx: ContextMap,
    index: number,
    parent: BaseInstance | null,
    rctx: RenderContext,
  ) {
    this.vnode = vnode;
    this.index = index;
    this.parent = parent;
    this.ctx = ctx;
    this.rctx = rctx;
    // Strip framework directives ($key, $shown) and merge positional children
    // into $children. Uses the same `propsWithChildren` that the reconciler's
    // `setProps` path uses, so initial and updated props have the same shape.
    this.props = propsWithChildren(vnode);
    this.path = parent ? [...parent.path, index] : [index];
    this.startAnchor = document.createComment(this.debugLabel());
    if (parent) parent.children.push(this);
  }

  debugLabel(): string {
    const { type } = this.vnode;
    if (typeof type === "string") return `<${type}>`;
    if (typeof type === "function") return `<${type.name || "Component"}>`;
    return "<?>";
  }

  // ── Public lifecycle ──────────────────────────────────────────────────

  /** Feed new props into this instance. No-op if shallow-equal (lazy). */
  setProps(next: VNodeProps): void {
    if (this.unmounted) return;
    if (shallowEqual(this.props, next)) return;
    this.pendingProps = next;
    this.scheduleRender();
  }

  /**
   * Enqueue a render under the given reason. If no reason is passed a
   * default symbol is used — callers that want per-source bookkeeping
   * (e.g. context subscribers) should pass their own reason.
   */
  scheduleRender(reason: symbol = DEFAULT_SCHEDULE_REASON): void {
    if (this.unmounted) return;
    this.renderReasons.add(reason);
    this.rctx.scheduler.schedule(this);
  }

  /**
   * Drop a render reason. If no reasons remain the instance is removed
   * from the scheduler queue. Used by context subscribers that decided
   * the value change was not relevant to their selector.
   */
  unscheduleRender(reason: symbol): void {
    if (!this.renderReasons.delete(reason)) return;
    if (this.renderReasons.size === 0) {
      this.rctx.scheduler.unschedule(this);
    }
  }

  /**
   * Template method: the scheduler calls this; the implementation in
   * `doRender()` is where concrete instances invoke their generator or
   * update their context handle. Reasons are cleared once `doRender()`
   * returns so a subsequent scheduling round starts from a clean slate.
   */
  render(): void {
    if (this.unmounted) return;
    try {
      this.doRender();
    } finally {
      this.renderReasons.clear();
    }
  }

  protected abstract doRender(): void;

  /**
   * Post-render hook pass — walks `hookStates` and runs any side effects
   * deferred during render: starting/restarting effects, and setting up
   * context subscriptions on first run. Called by the scheduler after the
   * DOM commit.
   */
  afterRender(): void {
    if (this.unmounted) {
      this.runHookCleanupsLeafFirst();
      return;
    }
    // Clean up any children unmounted during this render — leaf-first.
    this.cleanupUnmountedChildren();
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $STATE) {
        state.pendingResolve?.();
        state.pendingResolve = undefined;
      } else if (state.type === $EFFECT) {
        if (!state.controller) {
          // First run.
          const controller = new AbortController();
          state.controller = controller;
          void state.fn(controller.signal);
        } else if (state.dirty) {
          // Deps changed — abort the previous run, start fresh.
          state.controller.abort();
          const controller = new AbortController();
          state.controller = controller;
          state.dirty = false;
          void state.fn(controller.signal);
        }
      } else if (state.type === $CONTEXT) {
        if (state.unsubscribe) continue;
        const handle = this.ctx.get(state.ctx) as ContextHandle | undefined;
        if (!handle) continue;
        state.unsubscribe = handle.subscribe(() => {
          if (this.unmounted) return;
          const current = state.depsSelector(handle.ref.current);
          state.currentSelected = current;
          if (!depsChanged(state.lastRenderedDepsSelected, current)) {
            this.unscheduleRender(state.reason);
            return;
          }
          this.scheduleRender(state.reason);
        });
      }
    }
  }

  /**
   * Mark this instance and its entire subtree as unmounted. Does NOT
   * touch the DOM or run hook cleanups — the reconciler handles DOM
   * removal, and `afterRender` on the parent cleans up hooks leaf-first.
   */
  unmount(): void {
    if (this.unmounted) return;
    this.unmounted = true;
    for (const child of this.children) {
      child.unmount();
    }
  }

  // ── Protected helpers ─────────────────────────────────────────────────

  protected applyPendingProps(): void {
    if (this.pendingProps !== null) {
      this.props = this.pendingProps;
      this.pendingProps = null;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Walk children and clean up any that were unmounted during this
   * render. Recurses leaf-first so the deepest descendants abort their
   * effects and unsubscribe from contexts before their ancestors.
   * Unmounted children are removed from the `children` list afterward.
   */
  private cleanupUnmountedChildren(): void {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (!child?.unmounted) continue;
      child.runHookCleanupsLeafFirst();
      this.children.splice(i, 1);
    }
  }

  /**
   * Abort effect controllers and unsubscribe from context handles,
   * recursing into children first so cleanup runs leaf-up.
   */
  private runHookCleanupsLeafFirst(): void {
    for (const child of this.children) {
      child.runHookCleanupsLeafFirst();
    }
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $EFFECT) {
        state.controller?.abort();
      } else if (state.type === $CONTEXT) {
        state.unsubscribe?.();
      }
    }
  }
}
