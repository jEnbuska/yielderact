/**
 * driver.ts — Unified generator driver for the render pipeline.
 *
 * Every step in rendering is a yield. The driver loop handles all yield
 * types in one switch:
 *
 * - GET_CONTEXT_MAP: read the current context map
 * - Hook descriptors (USE_STATE, USE_EFFECT, etc.): dispatched to onHook
 * - void/undefined: scheduling pause (no-op in sync mode)
 *
 * The driver is the single point of control.
 */

import type { Context } from "../context";
import type { CtxMap } from "./types";

// ── Yield protocol ───────────────────────────────────────────────────────

const $GET_CONTEXT_MAP = Symbol("GET_CONTEXT_MAP");

export type { CtxMap } from "./types";

/** Any generator that participates in the render pipeline. */
export type RenderGenerator<TReturn> = Generator<unknown, TReturn, unknown>;

// ── Yield helpers ────────────────────────────────────────────────────────

/** Yield to read the full current context map. */
export function* getContextMap(): RenderGenerator<CtxMap> {
  return (yield { op: $GET_CONTEXT_MAP }) as CtxMap;
}

// ── Type guards ──────────────────────────────────────────────────────────

function isGetContextMap(v: unknown): boolean {
  return (
    v !== null &&
    v !== undefined &&
    typeof v === "object" &&
    (v as { op?: unknown }).op === $GET_CONTEXT_MAP
  );
}

// ── Driver ───────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: Context is contravariant in T; `any` avoids variance issues in the map key.
type BaseCtxMap = ReadonlyMap<Context<any>, unknown>;

/**
 * Wrap a generator with a scoped context map.
 *
 * Returns a new generator that handles GET_CONTEXT_MAP
 * internally (scoped to this subtree) and forwards everything else to
 * the caller. The caller drives the returned generator via yield* and
 * can stop at any time.
 *
 * This is the key mechanism for context scoping: each child in a loop
 * gets its own driveWithContext scope, so context changes in one child
 * don't leak to siblings.
 */
export function* driveWithContext<T>(
  ctxMap: BaseCtxMap,
  gen: RenderGenerator<T>,
): RenderGenerator<T> {
  const currentMap: BaseCtxMap = ctxMap;
  let result = gen.next();

  while (!result.done) {
    const { value } = result;

    if (isGetContextMap(value)) {
      result = gen.next(currentMap);
    } else {
      // Forward everything else (hooks, void, unknown) to the caller
      const sent = yield value;
      result = gen.next(sent);
    }
  }

  return result.value;
}
