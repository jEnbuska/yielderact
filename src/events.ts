/**
 * Synthetic event wrapper for yract.
 *
 * Every browser DOM event received by an event handler is automatically
 * wrapped in a `SyntheticEvent` before being passed to the JSX handler prop.
 * This provides a stable, cross-browser-consistent interface -- similar to
 * React's SyntheticEvent -- while still giving full access to the underlying
 * native event via `nativeEvent`.
 *
 * Uses a Proxy under the hood so that native event properties (e.g. `clientX`,
 * `key`, `touches`) are accessible directly on the SyntheticEvent without
 * explicit copying.
 */

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

/**
 * A synthetic event wrapping the native browser event `E`.
 *
 * Gives typed access to common event properties and methods while exposing
 * the raw `nativeEvent` for advanced use-cases.
 *
 * @example
 * function* Counter(_props: object, rerender: () => void) {
 *   let count = 0;
 *   while (true) {
 *     yield (
 *       <button onClick={(e: SEvent<"click">) => {
 *         console.log(e.type);          // "click"
 *         console.log(e.nativeEvent);   // native MouseEvent
 *         count++;
 *         rerender();
 *       }}>
 *         {count}
 *       </button>
 *     );
 *   }
 * }
 */
export interface SyntheticEvent<E extends Event = Event, T extends EventTarget = EventTarget> {
  /** The underlying native browser event. */
  readonly nativeEvent: E;
  /** The DOM node that triggered the event (same as `nativeEvent.target`). */
  readonly target: EventTarget | null;
  /**
   * The DOM node whose event-listener prop was matched.
   * For delegated events this is set by the dispatch algorithm as it walks
   * the capture/bubble path. Typed as `T` so element-specific properties
   * (e.g. `.value` on `HTMLInputElement`) are accessible without casting.
   */
  readonly currentTarget: T | null;
  /** Lowercase name of the event, e.g. `"click"`. */
  readonly type: string;
  /** Whether the event bubbles up through the DOM. */
  readonly bubbles: boolean;
  /** Whether the event can be cancelled with `preventDefault()`. */
  readonly cancelable: boolean;
  /** Whether `preventDefault()` has been called. */
  readonly defaultPrevented: boolean;
  /** Time (ms since epoch) when the event was created. */
  readonly timeStamp: number;
  /** Prevent the browser's default action for this event. */
  preventDefault(): void;
  /** Stop the event from bubbling further up the DOM tree. */
  stopPropagation(): void;
  /** Stop the event from reaching other listeners on the same element. */
  stopImmediatePropagation(): void;
  /** Whether `stopPropagation()` has been called on this event. */
  isPropagationStopped(): boolean;
  /** Whether `preventDefault()` has been called on this event. */
  isDefaultPrevented(): boolean;
}

// ---------------------------------------------------------------------------
// Convenient named-event alias
// ---------------------------------------------------------------------------

/**
 * Shorthand for `SyntheticEvent<HTMLElementEventMap[K]>`.
 *
 * Use this to type event handler parameters in component props and JSX:
 *
 * ```tsx
 * <button onClick={(e: SEvent<"click">) => { ... }}>Click</button>
 * <input  onInput={(e: SEvent<"input">) => { ... }} />
 * <input  onKeydown={(e: SEvent<"keydown">) => { ... }} />
 * ```
 *
 * `K` is the **lowercase** DOM event name (matching
 * `keyof HTMLElementEventMap`).
 */
export type SEvent<K extends keyof HTMLElementEventMap> = SyntheticEvent<HTMLElementEventMap[K]>;

// ---------------------------------------------------------------------------
// Internal type for dispatch algorithm
// ---------------------------------------------------------------------------

/**
 * Extended SyntheticEvent with internal methods used by the dispatch
 * algorithm to control `currentTarget` and query propagation state.
 *
 * @internal
 */
interface _DelegatableEvent<E extends Event = Event> extends SyntheticEvent<E> {
  /** Set `currentTarget` during the dispatch walk. @internal */
  _setCurrentTarget(el: EventTarget | null): void;
  /** Query whether `stopPropagation()` was called. @internal */
  _isPropagationStopped(): boolean;
  /** Query whether `stopImmediatePropagation()` was called. @internal */
  _isImmediatePropagationStopped(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Wrap a native DOM event in a `SyntheticEvent` backed by a Proxy.
 *
 * Unknown property reads (e.g. `clientX`, `key`, `touches`) are proxied
 * through to the native event, so all event-type-specific data is
 * accessible without explicit copying.
 *
 * @param nativeEvent - The native browser event to wrap.
 * @param delegated   - `true` for events dispatched via the delegation root
 *   (stopPropagation does NOT call `nativeEvent.stopPropagation()` since
 *   the native event already reached the root). `false` for per-element
 *   non-delegated events (stopPropagation calls native method).
 */
export function createSyntheticEvent<E extends Event>(
  nativeEvent: E,
  delegated = false,
): _DelegatableEvent<E> {
  let _propagationStopped = false;
  let _immediatePropagationStopped = false;
  let _currentTarget: EventTarget | null = nativeEvent.currentTarget;

  // Object with all known properties — the Proxy falls through to
  // nativeEvent for anything not listed here.
  const overrides: Record<string, unknown> = {
    nativeEvent,
    target: nativeEvent.target,
    type: nativeEvent.type,
    bubbles: nativeEvent.bubbles,
    cancelable: nativeEvent.cancelable,
    timeStamp: nativeEvent.timeStamp,
  };

  // Pre-bound methods so the same function reference is returned on
  // every property access (prevents unnecessary allocations in hot paths).
  const preventDefaultFn = () => nativeEvent.preventDefault();
  const stopPropagationFn = () => {
    _propagationStopped = true;
    if (!delegated) nativeEvent.stopPropagation();
  };
  const stopImmediatePropagationFn = () => {
    _propagationStopped = true;
    _immediatePropagationStopped = true;
    if (!delegated) nativeEvent.stopImmediatePropagation();
  };
  const isPropagationStoppedFn = () => _propagationStopped;
  const isDefaultPreventedFn = () => nativeEvent.defaultPrevented;
  const _setCurrentTargetFn = (el: EventTarget | null) => {
    _currentTarget = el;
  };
  const _isPropagationStoppedFn = () => _propagationStopped;
  const _isImmediatePropagationStoppedFn = () => _immediatePropagationStopped;

  const methods: Record<string, unknown> = {
    preventDefault: preventDefaultFn,
    stopPropagation: stopPropagationFn,
    stopImmediatePropagation: stopImmediatePropagationFn,
    isPropagationStopped: isPropagationStoppedFn,
    isDefaultPrevented: isDefaultPreventedFn,
    _setCurrentTarget: _setCurrentTargetFn,
    _isPropagationStopped: _isPropagationStoppedFn,
    _isImmediatePropagationStopped: _isImmediatePropagationStoppedFn,
  };

  return new Proxy(overrides as unknown as _DelegatableEvent<E>, {
    get(_target, prop: string | symbol) {
      // Dynamic properties
      if (prop === "currentTarget") return _currentTarget;
      if (prop === "defaultPrevented") return nativeEvent.defaultPrevented;

      // Static overrides
      const key = prop as string;
      if (key in methods) return methods[key];
      if (key in overrides) return overrides[key];

      // Fall through to native event
      const val: unknown = (nativeEvent as Record<string | symbol, unknown>)[prop];
      if (typeof val === "function") return (val as (...a: never[]) => unknown).bind(nativeEvent);
      return val;
    },
  });
}
