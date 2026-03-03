/**
 * Synthetic event wrapper for yielderact.
 *
 * Every browser DOM event received by an event handler is automatically
 * wrapped in a `SyntheticEvent` before being passed to the JSX handler prop.
 * This provides a stable, cross-browser-consistent interface – similar to
 * React's SyntheticEvent – while still giving full access to the underlying
 * native event via `nativeEvent`.
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
export interface SyntheticEvent<E extends Event = Event> {
  /** The underlying native browser event. */
  readonly nativeEvent: E;
  /** The DOM node that triggered the event (same as `nativeEvent.target`). */
  readonly target: EventTarget | null;
  /**
   * The DOM node whose event-listener prop was matched
   * (same as `nativeEvent.currentTarget`).
   */
  readonly currentTarget: EventTarget | null;
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
export type SEvent<K extends keyof HTMLElementEventMap> =
  SyntheticEvent<HTMLElementEventMap[K]>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Wrap a native DOM event in a `SyntheticEvent` object.
 * Called automatically by the renderer in `applyProps`; you do not normally
 * need to call this yourself.
 */
export function createSyntheticEvent<E extends Event>(nativeEvent: E): SyntheticEvent<E> {
  return {
    nativeEvent,
    target: nativeEvent.target,
    currentTarget: nativeEvent.currentTarget,
    type: nativeEvent.type,
    bubbles: nativeEvent.bubbles,
    cancelable: nativeEvent.cancelable,
    defaultPrevented: nativeEvent.defaultPrevented,
    timeStamp: nativeEvent.timeStamp,
    preventDefault: () => nativeEvent.preventDefault(),
    stopPropagation: () => nativeEvent.stopPropagation(),
    stopImmediatePropagation: () => nativeEvent.stopImmediatePropagation(),
  };
}
