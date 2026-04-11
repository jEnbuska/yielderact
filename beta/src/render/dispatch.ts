/**
 * Delegated event dispatch — capture → bubble path walk.
 *
 * Invoked by a DelegationRoot when a native event fires on the root. We
 * build the DOM path from the event target up to (but not including) the
 * root, create a SyntheticEvent, then walk the path once in capture order
 * and once in bubble order, calling registered handlers at each element.
 * The whole dispatch is wrapped in a scheduler batch so multiple setState
 * calls coalesce into a single flush.
 */
import { createSyntheticEvent } from "../events";
import { getHandlers } from "./delegation";
import type { Scheduler } from "./scheduler";

export function dispatchDelegatedEvent(
  nativeEvent: Event,
  rootElement: Element,
  domEvent: string,
  scheduler: Scheduler,
): void {
  // 1. Build path: target → root (exclusive)
  const path: Element[] = [];
  let node: Node | null = nativeEvent.target as Node | null;
  while (node && node !== rootElement) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      path.push(node as Element);
    }
    node = node.parentNode;
  }

  if (path.length === 0) return;

  const syntheticEvent = createSyntheticEvent(nativeEvent, true);

  scheduler.beginBatch();
  try {
    // 2. Capture phase (root → target)
    for (let i = path.length - 1; i >= 0; i--) {
      const el = path[i];
      if (!el) continue;
      const entry = getHandlers(el, domEvent);
      if (entry?.capture) {
        syntheticEvent._setCurrentTarget(el);
        entry.capture(syntheticEvent);
        if (
          syntheticEvent._isImmediatePropagationStopped() ||
          syntheticEvent._isPropagationStopped()
        ) {
          return;
        }
      }
    }

    // 3. Bubble phase (target → root)
    for (let i = 0; i < path.length; i++) {
      const el = path[i];
      if (!el) continue;
      const entry = getHandlers(el, domEvent);
      if (entry?.bubble) {
        syntheticEvent._setCurrentTarget(el);
        entry.bubble(syntheticEvent);
        if (
          syntheticEvent._isImmediatePropagationStopped() ||
          syntheticEvent._isPropagationStopped()
        ) {
          return;
        }
      }
    }
  } finally {
    scheduler.endBatch();
  }
}
