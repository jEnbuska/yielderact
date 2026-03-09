/**
 * delegation.ts — Handler registry, prop-to-event mapping, and DelegationRoot.
 *
 * The event delegation system attaches a single native listener per event
 * type on the root container element. When an event fires, the dispatch
 * algorithm (in `dispatch.ts`) walks the DOM path from target to root,
 * looking up handlers in the registry at each element.
 *
 * **Handler registry:** `WeakMap<Element, Map<string, HandlerEntry>>` — maps
 * each DOM element to its event handlers by lowercase DOM event name.
 * Uses `WeakMap` so entries are garbage-collected when elements are removed.
 *
 * **DelegationRoot:** Lazily attaches root listeners the first time an event
 * type is encountered. Created by `render()` / `createRoot()`.
 */

import type { SyntheticEvent } from "../events";

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/** Stores bubble and/or capture handlers for one DOM event on one element. */
export interface HandlerEntry {
  bubble?: (e: SyntheticEvent) => void;
  capture?: (e: SyntheticEvent) => void;
}

/**
 * Maps each DOM element to its registered event handlers.
 *
 * Outer key: DOM element. Inner key: lowercase DOM event name (e.g. `"click"`).
 * Inner value: handlers for that event (bubble and/or capture).
 */
const _handlerRegistry = new WeakMap<Element, Map<string, HandlerEntry>>();

/**
 * Register a handler for a DOM event on an element.
 *
 * Called by `applyProps` / `updateProps` for delegated events.
 */
export function registerHandler(
  el: Element,
  domEvent: string,
  handler: (e: SyntheticEvent) => void,
  isCapture: boolean,
): void {
  let map = _handlerRegistry.get(el);
  if (!map) {
    map = new Map();
    _handlerRegistry.set(el, map);
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

/**
 * Remove a handler for a DOM event from an element.
 *
 * Called by `updateProps` when a handler is removed or replaced.
 */
export function unregisterHandler(el: Element, domEvent: string, isCapture: boolean): void {
  const map = _handlerRegistry.get(el);
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

/**
 * Look up the handler entry for a DOM event on an element.
 *
 * Called by the dispatch algorithm during the capture/bubble walk.
 */
export function getHandlers(el: Element, domEvent: string): HandlerEntry | undefined {
  return _handlerRegistry.get(el)?.get(domEvent);
}

// ---------------------------------------------------------------------------
// Non-delegated events
// ---------------------------------------------------------------------------

/**
 * Events that bypass delegation and are attached per-element.
 *
 * These events either don't bubble naturally or have semantics that
 * make delegation impractical (e.g. `scroll` fires on the scrolling
 * element only, `load`/`error` on the resource element).
 *
 * `mouseenter`/`mouseleave` and `pointerenter`/`pointerleave` don't
 * bubble, so they must be per-element in PR 1. PR 2 will convert them
 * to delegated `mouseover`/`mouseout` simulation.
 */
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

/**
 * Special prop-to-DOM-event mappings for props whose DOM event name
 * doesn't follow the default `propKey.slice(2).toLowerCase()` rule.
 */
const PROP_TO_DOM_EVENT: Record<string, string> = {
  onDoubleClick: "dblclick",
  onFocus: "focusin",
  onBlur: "focusout",
};

/**
 * Resolve a JSX event prop name to a DOM event name and capture flag.
 *
 * - Detects `Capture` suffix (e.g. `onClickCapture` → `click`, capture).
 * - Applies special mapping (e.g. `onDoubleClick` → `dblclick`).
 * - Falls back to `propKey.slice(2).toLowerCase()` for standard events.
 */
export function resolveEventProp(propKey: string): { domEvent: string; isCapture: boolean } {
  let isCapture = false;
  let baseProp = propKey;

  // Detect Capture suffix: "on" (2) + at least 1 char + "Capture" (7) = min 10
  if (propKey.endsWith("Capture") && propKey.length >= 10) {
    const withoutCapture = propKey.slice(0, -7);
    if (withoutCapture.length > 2) {
      isCapture = true;
      baseProp = withoutCapture;
    }
  }

  // Special mapping
  const mapped = PROP_TO_DOM_EVENT[baseProp];
  if (mapped) {
    return { domEvent: mapped, isCapture };
  }

  // Default: strip "on" and lowercase
  return { domEvent: baseProp.slice(2).toLowerCase(), isCapture };
}

// ---------------------------------------------------------------------------
// DelegationRoot
// ---------------------------------------------------------------------------

/**
 * Manages root-level native event listeners for one render root.
 *
 * Lazily attaches a root listener the first time an event type is
 * encountered via `ensureListening()`. The listener delegates to a
 * dispatch callback (provided at construction) which walks the DOM
 * path and invokes registered handlers.
 *
 * Created by `render()` / `createRoot()` and stored on `RenderContext`.
 */
export class DelegationRoot {
  private _root: Element;
  private _registeredTypes = new Set<string>();
  private _listeners = new Map<string, EventListener>();
  private _dispatch: (nativeEvent: Event, domEvent: string) => void;

  constructor(root: Element, dispatch: (nativeEvent: Event, domEvent: string) => void) {
    this._root = root;
    this._dispatch = dispatch;
  }

  /** Lazily attach a root listener for the given DOM event type. */
  ensureListening(domEvent: string): void {
    if (this._registeredTypes.has(domEvent)) return;
    this._registeredTypes.add(domEvent);

    const listener: EventListener = (nativeEvent: Event) => {
      this._dispatch(nativeEvent, domEvent);
    };
    this._listeners.set(domEvent, listener);
    this._root.addEventListener(domEvent, listener);
  }

  /** Remove all root listeners. For future cleanup / unmount support. */
  dispose(): void {
    for (const [domEvent, listener] of this._listeners) {
      this._root.removeEventListener(domEvent, listener);
    }
    this._listeners.clear();
    this._registeredTypes.clear();
  }
}
