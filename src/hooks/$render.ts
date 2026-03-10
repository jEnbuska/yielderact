import { $context, createContext } from "../context";
import { type Child, createElement } from "../jsx";
import { $RENDER, depsChanged, type HookContext } from "./symbols";

/**
 * Inline render factory passed to `$render` (Variant 2).
 *
 * Receives `{ resume }` and must return the JSX to render while waiting.
 * Call `resume(value)` when the user has made a choice – this unblocks
 * the parent generator and makes `yield* $render(...)` return `value`.
 */
export type UseRenderFn<T> = (props: { resume: (value: T) => void }) => Child;

/**
 * State object for one `$render` hook slot.
 * Stored in the component's `hookStates` array by the renderer.
 * @internal
 */
export type UseRenderState<T> = {
  kind: "render";
  status: "waiting" | "resolved";
  deps: unknown[];
  value: T | undefined;
  /** Stable callback reference – created once per deps change and reused. */
  resumeCallback: (value: T) => void;
};

// Internal context propagating the resume callback to child components.
const _resumeCtx = createContext<((value: unknown) => void) | null>(null);

/**
 * Interactive render hook for generator components.
 *
 * Pauses the generator and renders UI until `resume(value)` is called.
 * Whatever is passed to `resume` is returned from `yield* $render(...)`,
 * and the generator then continues from where it was paused.
 *
 * Two variants are supported:
 *
 * **Variant 1 – pass JSX directly.**  The rendered child component obtains
 * the `resume` callback via `yield* $resume()`:
 *
 * @example
 * // Child component – calls $resume to get the parent's resume callback
 * function* ConfirmDialog(_props: object) {
 *   const resume = yield* $resume<'YES' | 'NO'>();
 *   return (
 *     <div>
 *       <button onClick={() => resume('YES')}>Yes</button>
 *       <button onClick={() => resume('NO')}>No</button>
 *     </div>
 *   );
 * }
 *
 * // Parent – passes JSX directly; resumes when the child calls resume()
 * function* Form(_props: object) {
 *   const answer = yield* $ref<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* $render<'YES' | 'NO'>(<ConfirmDialog />);
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 *
 * **Variant 2 – inline render function.**  `resume` is injected directly into
 * `fn` as a prop.  The required `deps` array controls when the rendered output
 * is considered stale – pass `[]` to render the same UI for the component's
 * lifetime, or pass values that, when changed, should reset the interaction:
 *
 * @example
 * function* Form(_props: object) {
 *   const answer = yield* $ref<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* $render<'YES' | 'NO'>(
 *       ({ resume }) => (
 *         <div>
 *           <button onClick={() => resume('YES')}>Yes</button>
 *           <button onClick={() => resume('NO')}>No</button>
 *         </div>
 *       ),
 *       [],
 *     );
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 *
 * Must be called with `yield*` inside a generator component.
 */
export function $render<T>(child: Child): Generator<unknown, T, unknown>;
export function $render<T>(fn: UseRenderFn<T>, deps: unknown[]): Generator<unknown, T, unknown>;
export function* $render<T>(
  fnOrChild: Child | UseRenderFn<T>,
  deps?: unknown[],
): Generator<unknown, T, unknown> {
  // Request a persistent slot + stable resumeCallback from the renderer.
  const effectiveDeps = deps ?? [];
  const caps = yield { type: $RENDER, deps: effectiveDeps };
  const { slot, resumeCallback } = caps as {
    slot: UseRenderState<T>;
    resumeCallback: (value: T) => void;
  };

  const isInline = typeof fnOrChild === "function";

  while (slot.status === "waiting") {
    const rawChild = isInline
      ? (fnOrChild as UseRenderFn<T>)({ resume: resumeCallback })
      : (fnOrChild as Child);
    // Wrap in the internal resume context so nested components can access `resume` via $resume().
    yield createElement(
      _resumeCtx.Provider,
      { value: resumeCallback as (value: unknown) => void },
      rawChild,
    );
  }

  return slot.value as T;
}

/**
 * Returns the `resume` callback injected by the nearest parent `$render` call.
 *
 * Calling `resume(value)` unblocks the parent generator, unmounts this
 * component, and makes `yield* $render(...)` return `value`.  The component
 * itself does not need to do anything further after calling `resume` – the
 * parent takes over from that point.
 *
 * Must be called with `yield*` inside a generator component that is rendered
 * by a parent via `$render` (Variant 1).  Throws if called outside that
 * context.
 *
 * @example
 * // Child – receives resume from the parent's $render context
 * function* ConfirmDialog(_props: object) {
 *   const resume = yield* $resume<'YES' | 'NO'>();
 *   return (
 *     <div>
 *       <button onClick={() => resume('YES')}>Yes</button>
 *       <button onClick={() => resume('NO')}>No</button>
 *     </div>
 *   );
 * }
 *
 * // Parent – passes the child via JSX; resumes when the child calls resume()
 * function* Form(_props: object) {
 *   const answer = yield* $ref<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* $render<'YES' | 'NO'>(<ConfirmDialog />);
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 */
export function* $resume<T>(): Generator<unknown, (value: T) => void, unknown> {
  const fn = yield* $context(_resumeCtx);
  if (fn === null) {
    throw new Error("$resume must be called inside a component rendered by $render");
  }
  return fn as (value: T) => void;
}

/** @internal */
export function _processRender(descriptor: { [key: string]: unknown }, ctx: HookContext): unknown {
  const { hookIndex, hookStates, resume } = ctx;
  const deps = descriptor["deps"] as unknown[];
  const existing = hookStates[hookIndex];
  let slot: UseRenderState<unknown>;

  if (existing === undefined || existing.kind !== "render" || depsChanged(existing.deps, deps)) {
    const newSlot: UseRenderState<unknown> = {
      kind: "render",
      status: "waiting",
      deps,
      value: undefined,
      resumeCallback: null as unknown as (value: unknown) => void,
    };
    hookStates[hookIndex] = newSlot;
    newSlot.resumeCallback = (value: unknown): void => {
      const s = hookStates[hookIndex];
      if (s !== undefined && s.kind === "render" && s.status === "waiting") {
        s.status = "resolved";
        s.value = value;
        resume();
      }
    };
    slot = newSlot;
  } else {
    existing.status = "waiting";
    slot = existing;
  }

  return { slot, resumeCallback: slot.resumeCallback };
}
