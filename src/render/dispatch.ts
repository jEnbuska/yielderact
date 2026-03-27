/**
 * dispatch.ts — Delegated event dispatch algorithm.
 *
 * When a native event reaches the delegation root, this module:
 * 1. Builds a DOM path from `event.target` up to the root container.
 * 2. Creates a Proxy-based SyntheticEvent.
 * 3. Walks the path in capture phase (root → target), then bubble phase
 *    (target → root), calling registered handlers at each element.
 * 4. Wraps the entire dispatch in a batching context so multiple
 *    `setState` calls during one event are processed in a single pass.
 */

import { createSyntheticEvent } from "../events";
import { getHandlers } from "./delegation";
import { _flushPendingWork } from "./scheduler";
import { setActiveCtx } from "./state";
import type { RenderContext } from "./types";

/**
 * Dispatch a delegated event through the synthetic capture → bubble phases.
 *
 * Called by the `DelegationRoot`'s native listener when an event reaches
 * the root container element.
 *
 * @param nativeEvent - The native DOM event.
 * @param rootElement - The delegation root container element.
 * @param domEvent    - The lowercase DOM event name (e.g. `"click"`).
 * @param rctx        - The render context for this root.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: capture+bubble dispatch with propagation checks
export function dispatchDelegatedEvent(
  nativeEvent: Event,
  rootElement: Element,
  domEvent: string,
  rctx: RenderContext,
): void {
  // 1. Build path: walk from target up to (but not including) root.
  //    Collect only Element nodes (skip Text/Comment nodes).
  const path: Element[] = [];
  let node: Node | null = nativeEvent.target as Node | null;
  while (node && node !== rootElement) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      path.push(node as Element);
    }
    node = node.parentNode;
  }
  // path[0] = target element, path[length-1] = child of root

  if (path.length === 0) return;

  // 2. Create SyntheticEvent (delegated = true: stopPropagation only
  //    affects the synthetic dispatch, not the native event).
  const syntheticEvent = createSyntheticEvent(nativeEvent, true);

  // 3. Batching: suppress immediate scheduling during dispatch so
  //    multiple setState calls are batched into a single render pass.
  setActiveCtx(rctx);
  const { isProcessing: wasProcessing } = rctx;
  rctx.isProcessing = true;

  try {
    // 4. Capture phase (root → target): walk path from outermost to innermost.
    for (let i = path.length - 1; i >= 0; i--) {
      const el = path[i] as Element;
      const entry = getHandlers(el, domEvent);
      if (entry?.capture) {
        syntheticEvent._setCurrentTarget(el);
        entry.capture(syntheticEvent);
        if (
          syntheticEvent._isImmediatePropagationStopped() ||
          syntheticEvent._isPropagationStopped()
        ) {
          break;
        }
      }
    }

    // 5. Bubble phase (target → root): walk path from innermost to outermost.
    if (!syntheticEvent._isPropagationStopped()) {
      for (let i = 0; i < path.length; i++) {
        const el = path[i] as Element;
        const entry = getHandlers(el, domEvent);
        if (entry?.bubble) {
          syntheticEvent._setCurrentTarget(el);
          entry.bubble(syntheticEvent);
          if (
            syntheticEvent._isImmediatePropagationStopped() ||
            syntheticEvent._isPropagationStopped()
          ) {
            break;
          }
        }
      }
    }
  } finally {
    // 6. Restore batching state and flush any queued work.
    rctx.isProcessing = wasProcessing;
    if (!wasProcessing) {
      _flushPendingWork(rctx);
    }
  }
}
