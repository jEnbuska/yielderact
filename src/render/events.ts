import { createSyntheticEvent, type SyntheticEvent } from "../events";

/**
 * Maps each DOM element to its currently-registered synthetic event wrappers.
 *
 * Outer key: the DOM element. Inner key: lowercase event name (e.g. `"click"`).
 * Inner value: the wrapper `EventListener` that was passed to `addEventListener`.
 *
 * This tracking is necessary because yielderact wraps user handlers in a
 * synthetic-event adapter. When a handler changes (e.g. the parent re-renders
 * with a new `onClick`), `updateProps` must remove the *exact wrapper* that
 * was previously added — not the user's handler, which is a different function.
 *
 * Uses a `WeakMap` so entries are garbage-collected when elements are removed.
 */
const listenerWrappers = new WeakMap<HTMLElement, Map<string, EventListener>>();

/**
 * Attach a synthetic event listener to a DOM element.
 *
 * Wraps the user-provided `handler` so it receives a `SyntheticEvent`
 * instead of a native `Event`. Stores the wrapper in `listenerWrappers`
 * so it can be removed later by `removeSyntheticListener`.
 *
 * **Called by:** `applyProps` (initial mount) and `updateProps` (when an
 * `onXxx` handler is added or replaced) in `props.ts`.
 *
 * @param el        - The DOM element to listen on.
 * @param eventName - Lowercase event name (e.g. `"click"`, `"input"`).
 * @param handler   - The user's event handler that receives a SyntheticEvent.
 */
export function addSyntheticListener(
  el: HTMLElement,
  eventName: string,
  handler: (e: SyntheticEvent) => void,
): void {
  const wrapper: EventListener = (nativeEvent: Event) => handler(createSyntheticEvent(nativeEvent));
  el.addEventListener(eventName, wrapper);
  let map = listenerWrappers.get(el);
  if (!map) {
    map = new Map();
    listenerWrappers.set(el, map);
  }
  map.set(eventName, wrapper);
}

/**
 * Remove a previously-attached synthetic event listener from a DOM element.
 *
 * Looks up the wrapper in `listenerWrappers` and calls `removeEventListener`
 * with the exact same function reference that was originally added.
 *
 * **Called by:** `updateProps` in `props.ts` — when an `onXxx` handler is
 * removed or replaced with a new handler.
 *
 * @param el        - The DOM element to remove the listener from.
 * @param eventName - Lowercase event name (must match the name used in `addSyntheticListener`).
 */
export function removeSyntheticListener(el: HTMLElement, eventName: string): void {
  const wrapper = listenerWrappers.get(el)?.get(eventName);
  if (wrapper) {
    el.removeEventListener(eventName, wrapper);
    listenerWrappers.get(el)?.delete(eventName);
  }
}
