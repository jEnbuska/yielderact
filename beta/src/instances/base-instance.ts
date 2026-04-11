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
import { $CONTEXT, $EFFECT } from "../hooks/descriptors";
import type { ComponentGenerator } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { Child, VNode, VNodeProps } from "../jsx";
import { shallowEqual } from "../prop-helpers";
import type { Slot } from "../render/slots";
import type { ContextHandle } from "../context";
import type { ContextMap, HookState, RenderContext } from "../render/types";

const DEFAULT_SCHEDULE_REASON = Symbol("default");

export abstract class BaseInstance {
  readonly vnode: VNode;
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
  readonly endAnchor: Comment;

  constructor(
    vnode: VNode,
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
    // Merge positional children into `$children` so the generator body sees
    // them via props. The reconciler's `setProps` path does the same via
    // `propsWithChildren(vnode)`.
    this.props =
      vnode.children.length > 0
        ? { ...vnode.props, $children: vnode.children }
        : vnode.props;
    this.path = parent ? [...parent.path, index] : [index];
    this.startAnchor = document.createComment(this.debugLabel());
    this.endAnchor = document.createComment("/");
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
    if (this.unmounted) return;
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $EFFECT) {
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
   * Tear down this instance and its subtree. Does NOT touch the DOM —
   * the reconciler is responsible for removing nodes. Responsibilities:
   *
   *  1. Mark unmounted so no new renders happen
   *  2. Cascade into child instances (leaf-up)
   *  3. Walk `hookStates` to abort effect controllers and unsubscribe
   *     from context handles
   *  4. Drop this instance from its parent's child list
   */
  unmount(): void {
    if (this.unmounted) return;
    this.unmounted = true;
    this.cascadeUnmountToChildren();
    this.runHookCleanups();
    this.detachFromParent();
  }

  // ── Protected helpers ─────────────────────────────────────────────────

  protected applyPendingProps(): void {
    if (this.pendingProps !== null) {
      this.props = this.pendingProps;
      this.pendingProps = null;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private cascadeUnmountToChildren(): void {
    for (const child of this.children.slice()) {
      child.unmount();
    }
    this.children.length = 0;
  }

  private runHookCleanups(): void {
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $EFFECT) {
        state.controller?.abort();
      } else if (state.type === $CONTEXT) {
        state.unsubscribe?.();
      }
    }
  }

  private detachFromParent(): void {
    if (!this.parent) return;
    const i = this.parent.children.indexOf(this);
    if (i >= 0) this.parent.children.splice(i, 1);
  }
}
