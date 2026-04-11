/**
 * delegation.ts — Handler registry, prop-to-event mapping, and DelegationRoot.
 *
 * A single native listener per event type is attached on the root container.
 * When an event fires, the dispatch algorithm (dispatch.ts) walks the DOM path
 * from target to root, looking up handlers in the registry at each element.
 */
import type { SyntheticEvent } from "../events";

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

interface HandlerEntry {
  bubble?: (e: SyntheticEvent) => void;
  capture?: (e: SyntheticEvent) => void;
}

const handlerRegistry = new WeakMap<Element, Map<string, HandlerEntry>>();

export function registerHandler(
  el: Element,
  domEvent: string,
  handler: (e: SyntheticEvent) => void,
  isCapture: boolean,
): void {
  let map = handlerRegistry.get(el);
  if (!map) {
    map = new Map();
    handlerRegistry.set(el, map);
  }
  let entry = map.get(domEvent);
  if (!entry) {
    entry = {};
    map.set(domEvent, entry);
  }
  if (isCapture) {
    entry.capture = handler;
  } else {
    entry.bubble = handler;
  }
}

export function unregisterHandler(el: Element, domEvent: string, isCapture: boolean): void {
  const map = handlerRegistry.get(el);
  if (!map) return;
  const entry = map.get(domEvent);
  if (!entry) return;
  if (isCapture) {
    delete entry.capture;
  } else {
    delete entry.bubble;
  }
  if (!entry.capture && !entry.bubble) {
    map.delete(domEvent);
  }
}

export function getHandlers(el: Element, domEvent: string): HandlerEntry | undefined {
  return handlerRegistry.get(el)?.get(domEvent);
}

// ---------------------------------------------------------------------------
// Non-delegated events
// ---------------------------------------------------------------------------

export const NON_DELEGATED_EVENTS = new Set([
  "scroll",
  "scrollend",
  "cancel",
  "close",
  "invalid",
  "load",
  "error",
  "toggle",
  "mouseenter",
  "mouseleave",
  "pointerenter",
  "pointerleave",
]);

// ---------------------------------------------------------------------------
// Prop name → DOM event mapping
// ---------------------------------------------------------------------------

const PROP_TO_DOM_EVENT: Record<string, string> = {
  onDoubleClick: "dblclick",
  onFocus: "focusin",
  onBlur: "focusout",
};

export function resolveEventProp(propKey: string): { domEvent: string; isCapture: boolean } {
  let isCapture = false;
  let baseProp = propKey;

  if (propKey.endsWith("Capture") && propKey.length >= 10) {
    const withoutCapture = propKey.slice(0, -7);
    if (withoutCapture.length > 2) {
      isCapture = true;
      baseProp = withoutCapture;
    }
  }

  const mapped = PROP_TO_DOM_EVENT[baseProp];
  if (mapped) {
    return { domEvent: mapped, isCapture };
  }

  return { domEvent: baseProp.slice(2).toLowerCase(), isCapture };
}

// ---------------------------------------------------------------------------
// DelegationRoot
// ---------------------------------------------------------------------------

export class DelegationRoot {
  private readonly _root: Element;
  private readonly _registeredTypes = new Set<string>();
  private readonly _listeners = new Map<string, EventListener>();
  private readonly _dispatch: (nativeEvent: Event, domEvent: string) => void;

  constructor(root: Element, dispatch: (nativeEvent: Event, domEvent: string) => void) {
    this._root = root;
    this._dispatch = dispatch;
  }

  ensureListening(domEvent: string): void {
    if (this._registeredTypes.has(domEvent)) return;
    this._registeredTypes.add(domEvent);

    const listener: EventListener = (nativeEvent: Event) => {
      this._dispatch(nativeEvent, domEvent);
    };
    this._listeners.set(domEvent, listener);
    this._root.addEventListener(domEvent, listener);
  }

  dispose(): void {
    for (const [domEvent, listener] of this._listeners) {
      this._root.removeEventListener(domEvent, listener);
    }
    this._listeners.clear();
    this._registeredTypes.clear();
  }
}
