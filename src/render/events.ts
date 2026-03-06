import { createSyntheticEvent, type SyntheticEvent } from '../events';

/**
 * Maps each DOM element to its currently-registered synthetic event wrappers.
 * Key is the lowercase event name (e.g. `"click"`).
 * This lets `updateProps` remove the exact wrapper added by `applyProps`.
 */
const listenerWrappers = new WeakMap<HTMLElement, Map<string, EventListener>>();

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

export function removeSyntheticListener(el: HTMLElement, eventName: string): void {
  const wrapper = listenerWrappers.get(el)?.get(eventName);
  if (wrapper) {
    el.removeEventListener(eventName, wrapper);
    listenerWrappers.get(el)!.delete(eventName);
  }
}
