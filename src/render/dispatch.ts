/**
 * dispatch.ts — Delegated event dispatch algorithm.
 *
 * When a native event reaches the delegation root, this module:
 * 1. Builds a DOM path from `event.target` up to the root container.
 * 2. Creates a Proxy-based SyntheticEvent.
 * 3. Walks the path in capture phase (root → target), then bubble phase
 *    (target → root), calling registered handlers at each element.
 * 4. Wraps the entire dispatch in the scheduler's `flushSync` so multiple
 *    `setState` calls during one event are processed in a single pass.
 */

import { createSyntheticEvent } from "../events";
import { getHandlers } from "./delegation";
import type { Scheduler } from "./scheduler";

/**
 * Dispatch a delegated event through the synthetic capture → bubble phases.
 *
 * Called by the `DelegationRoot`'s native listener when an event reaches
 * the root container element.
 *
 * @param nativeEvent - The native DOM event.
 * @param rootElement - The delegation root container element.
 * @param domEvent    - The lowercase DOM event name (e.g. `"click"`).
 * @param scheduler   - The scheduler for this root.
 */
export function dispatchDelegatedEvent(
  nativeEvent: Event,
  rootElement: Element,
  domEvent: string,
  scheduler: Scheduler,
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

  // 3. Use flushSync to batch all setState calls during dispatch and
  //    flush pending work after the dispatch completes.
  scheduler.flushSync(() => dispatchPhases(path, syntheticEvent, domEvent));
}

/**
 * Run the capture and bubble dispatch phases for a synthetic event.
 *
 * Extracted from `dispatchDelegatedEvent` so the complexity biome-ignore
 * stays on the architectural dispatch function.
 */
function dispatchPhases(
  path: Element[],
  syntheticEvent: ReturnType<typeof createSyntheticEvent>,
  domEvent: string,
): void {
  // Capture phase (root → target): walk path from outermost to innermost.
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

  // Bubble phase (target → root): walk path from innermost to outermost.
  if (syntheticEvent._isPropagationStopped()) return;
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
