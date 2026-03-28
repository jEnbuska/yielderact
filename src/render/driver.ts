/**
 * driver.ts — Unified generator driver for the render pipeline.
 *
 * Every step in rendering is a yield. The driver loop handles all yield
 * types in one switch:
 *
 * - SET_CONTEXT: update the context map for the current subtree
 * - GET_CONTEXT_MAP: read the current context map
 * - Hook descriptors (USE_STATE, USE_EFFECT, etc.): dispatched to onHook
 * - void/undefined: scheduling pause (no-op in sync mode)
 *
 * The driver is the single point of control.
 */

import type { Context } from "../context";
import type { CtxMap } from "./types";

// ── Yield protocol ───────────────────────────────────────────────────────

const $SET_CONTEXT = Symbol("SET_CONTEXT");
const $GET_CONTEXT_MAP = Symbol("GET_CONTEXT_MAP");

export type { CtxMap } from "./types";

/** Any generator that participates in the render pipeline. */
export type RenderGenerator<TReturn> = Generator<unknown, TReturn, unknown>;

// ── Yield helpers ────────────────────────────────────────────────────────

/** Yield to update a context value for the current subtree. */
export function* setContext<T>(
  ctx: { readonly defaultValue: T },
  updater: (current: T) => T,
): RenderGenerator<void> {
  yield { op: $SET_CONTEXT, key: ctx, updater };
}

/** Yield to read the full current context map. */
export function* getContextMap(): RenderGenerator<CtxMap> {
  return (yield { op: $GET_CONTEXT_MAP }) as CtxMap;
}

// ── Type guards ──────────────────────────────────────────────────────────

function isSetContext(v: unknown): v is {
  op: typeof $SET_CONTEXT;
  key: { defaultValue: unknown };
  updater: (c: unknown) => unknown;
} {
  return (
    v !== null &&
    v !== undefined &&
    typeof v === "object" &&
    (v as { op?: unknown }).op === $SET_CONTEXT
  );
}

function isGetContextMap(v: unknown): boolean {
  return (
    v !== null &&
    v !== undefined &&
    typeof v === "object" &&
    (v as { op?: unknown }).op === $GET_CONTEXT_MAP
  );
}

// ── Driver ───────────────────────────────────────────────────────────────

type BaseCtxMap = ReadonlyMap<Context, unknown>;

/**
 * Wrap a generator with a scoped context map.
 *
 * Returns a new generator that handles SET_CONTEXT and GET_CONTEXT_MAP
 * internally (scoped to this subtree) and forwards everything else to
 * the caller. The caller drives the returned generator via yield* and
 * can stop at any time.
 *
 * This is the key mechanism for context scoping: each child in a loop
 * gets its own driveWithContext scope, so setContext in one child
 * doesn't leak to siblings.
 */
export function* driveWithContext<T>(
  ctxMap: BaseCtxMap,
  gen: RenderGenerator<T>,
): RenderGenerator<T> {
  let currentMap: BaseCtxMap = ctxMap;
  let result = gen.next();

  while (!result.done) {
    const { value } = result;

    if (isSetContext(value)) {
      const prev = currentMap.has(value.key) ? currentMap.get(value.key) : value.key.defaultValue;
      const next = new Map(currentMap);
      next.set(value.key, value.updater(prev));
      currentMap = next;
      result = gen.next(undefined);
    } else if (isGetContextMap(value)) {
      result = gen.next(currentMap);
    } else {
      // Forward everything else (hooks, void, unknown) to the caller
      const sent = yield value;
      result = gen.next(sent);
    }
  }

  return result.value;
}
