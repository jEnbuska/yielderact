/**
 * Per-element event listener management for non-delegated events.
 *
 * Events in `NON_DELEGATED_EVENTS` (scroll, load, error, etc.) bypass
 * the delegation system and are attached directly on the target element.
 * This module tracks the wrapper functions so they can be removed when
 * props change or the element is unmounted.
 *
 * For delegated events, see `actions.ts` and `dispatch.ts`.
 */

import { createSyntheticEvent, type SyntheticEvent } from "../events";
import type { AnyElement } from "./elements/namespaces";

/**
 * Maps each DOM element to its currently-registered non-delegated event
 * wrappers. Uses a `WeakMap` so entries are garbage-collected when
 * elements are removed.
 */
const listenerWrappers = new WeakMap<Element, Map<string, EventListener>>();

/**
 * Attach a non-delegated event listener to a DOM element.
 *
 * Wraps the user-provided `handler` so it receives a `SyntheticEvent`
 * (with `delegated=false`, meaning `stopPropagation` calls the native
 * method). Stores the wrapper for later removal.
 *
 * @param el        - The DOM element to listen on.
 * @param eventName - Lowercase event name (e.g. `"scroll"`, `"load"`).
 * @param handler   - The user's event handler.
 */
export function addNonDelegatedListener(
  el: Element,
  eventName: string,
  handler: (e: SyntheticEvent) => void,
): void {
  const wrapper: EventListener = (nativeEvent: Event) =>
    handler(createSyntheticEvent(nativeEvent, false));
  el.addEventListener(eventName, wrapper);
  let map = listenerWrappers.get(el);
  if (!map) {
    map = new Map();
    listenerWrappers.set(el, map);
  }
  map.set(eventName, wrapper);
}

/**
 * Remove a previously-attached non-delegated event listener.
 *
 * @param el        - The DOM element to remove the listener from.
 * @param eventName - Lowercase event name (must match the name used in
 *   `addNonDelegatedListener`).
 */
export function removeNonDelegatedListener(el: AnyElement, eventName: string): void {
  const wrapper = listenerWrappers.get(el)?.get(eventName);
  if (!wrapper) return;
  el.removeEventListener(eventName, wrapper);
  listenerWrappers.get(el)?.delete(eventName);
}
