/**
 * patch-queue.ts — Collects DOM operations during reconciliation for atomic commit.
 *
 * During a render pass, all mutations to the **live** DOM are collected into a
 * queue instead of being applied immediately. After reconciliation completes
 * for a priority level, the collected operations are flushed synchronously in
 * a single uninterruptible commit.
 *
 * Operations on **off-DOM** nodes (newly created elements not yet connected to
 * the document) execute immediately — they are invisible to the user regardless.
 *
 * **Called by:**
 * - `reconcileSlotsGen` / `reconcileOneGen` in `reconciler.ts` — DOM inserts,
 *   removes, text updates, prop updates.
 * - `removeSlotNodes` in `reconciler.ts` — DOM removals.
 * - The scheduler — `beginPatch()` before a priority pass, `commitPatch()`
 *   after reconciliation completes for that priority level.
 */

import { _requireActiveCtx } from "./state";

// ── Public API ───────────────────────────────────────────────────────────────

/** Begin collecting DOM operations for a new priority pass. */
export function beginPatch(): void {
  _requireActiveCtx().ops = [];
}

/**
 * Commit all collected DOM operations synchronously.
 *
 * The commit is a plain `for` loop — synchronous and uninterruptible — so the
 * browser never paints an intermediate visual state.
 *
 * Resets the queue to `undefined` (no active patch) after committing.
 */
export function commitPatch(): void {
  const ctx = _requireActiveCtx();
  if (!ctx.ops) return;
  const ops = ctx.ops;
  ctx.ops = undefined;
  for (let i = 0; i < ops.length; i++) ops[i]?.();
}

/** Returns `true` while a patch is being collected. */
export function isPatchActive(): boolean {
  return _requireActiveCtx().ops !== undefined;
}

/**
 * Save the current patch ops (for preemption).
 * Returns the ops array and resets the queue to empty (ready for higher-priority work).
 */
export function savePatchOps(): (() => void)[] {
  const ctx = _requireActiveCtx();
  const ops = ctx.ops ?? [];
  ctx.ops = [];
  return ops;
}

/**
 * Prepend previously saved ops before the current ops (for resuming after preemption).
 * The saved ops come first since they were collected before the preemption.
 */
export function restorePatchOps(saved: (() => void)[]): void {
  const ctx = _requireActiveCtx();
  if (!ctx.ops) {
    ctx.ops = saved;
    return;
  }
  ctx.ops = [...saved, ...ctx.ops];
}

// ── DOM operation wrappers ───────────────────────────────────────────────────
//
// Each wrapper checks whether a patch is active AND the target node is
// connected to the document (live DOM). If both conditions hold, the operation
// is enqueued for later commit. Otherwise it executes immediately.

/**
 * Wrapper for `parent.insertBefore(node, ref)`.
 * Defers insertion when the parent is in the live DOM and a patch is active.
 */
export function domInsertBefore(
  parent: Node,
  node: Node,
  ref: Node | null,
  ops: (() => void)[] | undefined,
): void {
  if (!ops || !parent.isConnected) {
    parent.insertBefore(node, ref);
    return;
  }
  ops.push(() => parent.insertBefore(node, ref));
}

/**
 * Wrapper for `parent.appendChild(node)`.
 * Defers when the parent is in the live DOM and a patch is active.
 */
export function domAppendChild(parent: Node, node: Node, ops: (() => void)[] | undefined): void {
  if (!ops || !parent.isConnected) {
    parent.appendChild(node);
    return;
  }
  ops.push(() => parent.appendChild(node));
}

/**
 * Wrapper for `parent.removeChild(node)`.
 * Defers when the node is in the live DOM and a patch is active.
 * Includes a safety check at commit time in case the node was already removed.
 */
export function domRemoveChild(parent: Node, node: Node, ops: (() => void)[] | undefined): void {
  if (!ops || !node.isConnected) {
    if (node.parentNode === parent) parent.removeChild(node);
    return;
  }
  ops.push(() => {
    if (node.parentNode) node.parentNode.removeChild(node);
  });
}

/**
 * Wrapper for setting `textNode.textContent`.
 * Defers when the text node is in the live DOM and a patch is active.
 */
export function domSetText(node: Text, text: string, ops: (() => void)[] | undefined): void {
  if (!ops || !node.isConnected) {
    node.textContent = text;
    return;
  }
  ops.push(() => {
    node.textContent = text;
  });
}

/**
 * Enqueue an arbitrary DOM operation.
 * If a patch is active, the operation is deferred. Otherwise it runs immediately.
 *
 * Use this for operations that don't fit the specific wrappers above
 * (e.g., `updateProps` on a live element).
 *
 * @param op       - The DOM operation to enqueue.
 * @param liveNode - A node used to check connectivity. If connected, the op
 *                   is deferred. If not connected (or omitted), the op runs now.
 * @param ops      - The current patch ops queue, or `undefined` if no patch is active.
 */
export function domEnqueue(
  op: () => void,
  liveNode: Node | undefined,
  ops: (() => void)[] | undefined,
): void {
  if (!ops || !liveNode?.isConnected) {
    op();
    return;
  }
  ops.push(op);
}
