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
import { dispatchDelegatedEvent } from "./dispatch";
import type { RenderContext } from "./types";

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/** Stores bubble and/or capture handlers for one DOM event on one element. */
interface HandlerEntry {
  bubble?: (e: SyntheticEvent) => void;
  capture?: (e: SyntheticEvent) => void;
}

/**
 * Maps each DOM element to its registered event handlers.
 *
 * Outer key: DOM element. Inner key: lowercase DOM event name (e.g. `"click"`).
 * Inner value: handlers for that event (bubble and/or capture).
 */
const handlerRegistry = new WeakMap<Element, Map<string, HandlerEntry>>();

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

/**
 * Remove a handler for a DOM event from an element.
 *
 * Called by `updateProps` when a handler is removed or replaced.
 */
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

/**
 * Look up the handler entry for a DOM event on an element.
 *
 * Called by the dispatch algorithm during the capture/bubble walk.
 */
export function getHandlers(el: Element, domEvent: string): HandlerEntry | undefined {
  return handlerRegistry.get(el)?.get(domEvent);
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
  private _stopNative: boolean;

  constructor(
    root: Element,
    dispatch: (nativeEvent: Event, domEvent: string) => void,
    stopNative = false,
  ) {
    this._root = root;
    this._dispatch = dispatch;
    this._stopNative = stopNative;
  }

  /** Lazily attach a root listener for the given DOM event type. */
  ensureListening(domEvent: string): void {
    if (this._registeredTypes.has(domEvent)) return;
    this._registeredTypes.add(domEvent);

    const listener: EventListener = (nativeEvent: Event) => {
      // Portal roots stop native propagation so parent delegation roots
      // do not re-dispatch the same event (avoids double-firing).
      if (this._stopNative) nativeEvent.stopPropagation();
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

// ---------------------------------------------------------------------------
// Portal delegation management
// ---------------------------------------------------------------------------

/** Ref-counted DelegationRoot entries for portal containers. */
const portalDelegationRoots = new Map<Element, { root: DelegationRoot; refCount: number }>();

/**
 * Acquire a DelegationRoot for a portal container. Multiple portals
 * targeting the same container share one DelegationRoot (ref-counted).
 */
export function acquirePortalDelegation(container: Element, rctx: RenderContext): DelegationRoot {
  const existing = portalDelegationRoots.get(container);
  if (existing) {
    existing.refCount++;
    return existing.root;
  }
  const root = new DelegationRoot(
    container,
    (nativeEvent, domEvent) => dispatchDelegatedEvent(nativeEvent, container, domEvent, rctx),
    true, // stop native propagation at portal boundary
  );
  portalDelegationRoots.set(container, { root, refCount: 1 });
  return root;
}

/**
 * Release a ref-counted DelegationRoot for a portal container.
 * When refCount hits 0, the root is disposed and removed.
 */
export function releasePortalDelegation(container: Element): void {
  const entry = portalDelegationRoots.get(container);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.root.dispose();
    portalDelegationRoots.delete(container);
  }
}
