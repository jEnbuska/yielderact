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
import { HOOK_TYPES, type HookDescriptor, type HookType } from "../hooks/descriptors";
import { RenderCtx, setActiveRenderCtx } from "./state";
import type { CtxMap, RenderContext } from "./types";

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

function isHookDescriptor(v: unknown): v is HookDescriptor {
  return v !== null && typeof v === "object" && HOOK_TYPES.has((v as { type: HookType }).type);
}

// ── Driver ───────────────────────────────────────────────────────────────

type BaseCtxMap = ReadonlyMap<Context, unknown>;

interface DriveResult<T> {
  value: T;
}

/**
 * Drive a render generator to completion.
 *
 * One loop handles context ops, hooks, and scheduling pauses.
 *
 * @param initialCtxMap - The starting context map.
 * @param gen - The generator to drive.
 * @param onHook - Optional hook handler. Returns the value to send back.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: architectural dispatch loop
export function drive<T>(
  initialCtxMap: BaseCtxMap,
  gen: RenderGenerator<T>,
  onHook?: (descriptor: HookDescriptor) => unknown,
): DriveResult<T> {
  // Set _activeCtx for synchronous leaf code (commit-queue, props) that
  // cannot yield and therefore cannot access the ctxMap via the driver.
  const rctx = initialCtxMap.get(RenderCtx as Context) as RenderContext | undefined;
  if (rctx) setActiveRenderCtx(rctx);

  let ctxMap: BaseCtxMap = initialCtxMap;
  let result = gen.next();

  while (!result.done) {
    const { value } = result;

    if (value === undefined) {
      result = gen.next(undefined);
    } else if (isSetContext(value)) {
      const prev = ctxMap.has(value.key) ? ctxMap.get(value.key) : value.key.defaultValue;
      const next = new Map(ctxMap);
      next.set(value.key, value.updater(prev));
      ctxMap = next;
      result = gen.next(undefined);
    } else if (isGetContextMap(value)) {
      result = gen.next(ctxMap);
    } else if (isHookDescriptor(value)) {
      if (!onHook) throw new Error(`Unexpected hook yield: ${value.type}`);
      result = gen.next(onHook(value));
    } else {
      result = gen.next(undefined);
    }
  }

  return { value: result.value };
}

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
