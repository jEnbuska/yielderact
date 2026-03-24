/**
 * driver.ts — Unified generator driver for the render pipeline.
 *
 * Every step in rendering is a yield from a generator. The driver loop
 * handles all yield types in one switch:
 *
 * - Context ops: SET_CONTEXT, GET_CONTEXT_MAP
 * - Hook descriptors: USE_STATE, USE_EFFECT, USE_CONTEXT, etc.
 * - void: scheduling pause (no-op in sync mode)
 *
 * The driver is the single point of control. Generators (buildNode,
 * mountComponent, reconciler) yield what they need, and the driver
 * decides how to handle it.
 */

import { HOOK_TYPES, type HookDescriptor, type HookType } from "../hooks/descriptors";

// ── Yield protocol ───────────────────────────────────────────────────────

const $SET_CONTEXT = Symbol("SET_CONTEXT");
const $GET_CONTEXT_MAP = Symbol("GET_CONTEXT_MAP");

export type CtxMap = ReadonlyMap<{ readonly _defaultValue: unknown }, unknown>;

/** @internal */
export type RenderGenerator<TReturn> = Generator<unknown, TReturn, unknown>;

// ── Yield helpers ────────────────────────────────────────────────────────

/** Yield to update a context value for the current subtree. */
export function* setContext<T>(
  ctx: { readonly _defaultValue: T },
  updater: (current: T) => T,
): RenderGenerator<void> {
  yield { op: $SET_CONTEXT, key: ctx, updater };
}

/** Yield to read the full current context map. */
export function* getContextMap(): RenderGenerator<CtxMap> {
  return (yield { op: $GET_CONTEXT_MAP }) as CtxMap;
}

// ── Type guards ──────────────────────────────────────────────────────────

function isSetContext(v: unknown): v is { op: typeof $SET_CONTEXT; key: { _defaultValue: unknown }; updater: (c: unknown) => unknown } {
  return v !== null && v !== undefined && typeof v === "object" && (v as { op?: unknown }).op === $SET_CONTEXT;
}

function isGetContextMap(v: unknown): v is { op: typeof $GET_CONTEXT_MAP } {
  return v !== null && v !== undefined && typeof v === "object" && (v as { op?: unknown }).op === $GET_CONTEXT_MAP;
}

function isHookDescriptor(v: unknown): v is HookDescriptor {
  return v !== null && typeof v === "object" && HOOK_TYPES.has((v as { type: HookType }).type);
}

// ── Driver ───────────────────────────────────────────────────────────────

/**
 * Drive a render generator to completion.
 *
 * One loop handles context ops, hooks, and scheduling pauses.
 *
 * @param initialCtxMap - The starting context map.
 * @param gen - The generator to drive.
 * @param onHook - Optional hook handler. If provided, hook descriptors are
 *   dispatched to it. If not provided, hooks cause an error.
 * @returns The generator's return value.
 */
export function drive<T>(
  initialCtxMap: CtxMap,
  gen: RenderGenerator<T>,
  onHook?: (descriptor: HookDescriptor) => unknown,
): { value: T; ctxMap: CtxMap } {
  let ctxMap = initialCtxMap;
  let result = gen.next();

  while (!result.done) {
    const yielded = result.value;

    if (yielded === undefined) {
      // void — scheduling pause
      result = gen.next(undefined);
    } else if (isSetContext(yielded)) {
      const prev = ctxMap.has(yielded.key) ? ctxMap.get(yielded.key) : yielded.key._defaultValue;
      const next = new Map(ctxMap);
      next.set(yielded.key, yielded.updater(prev));
      ctxMap = next;
      result = gen.next(undefined);
    } else if (isGetContextMap(yielded)) {
      result = gen.next(ctxMap);
    } else if (isHookDescriptor(yielded)) {
      if (!onHook) throw new Error(`Unexpected hook yield: ${yielded.type}`);
      result = gen.next(onHook(yielded));
    } else {
      // Unknown yield — pass through (future extensibility)
      result = gen.next(undefined);
    }
  }

  return { value: result.value, ctxMap };
}

/**
 * Convenience: drive a generator with context only (no hooks).
 * Same as drive() but returns just the value.
 */
export function driveWithContext<T>(ctxMap: CtxMap, gen: RenderGenerator<T>): T {
  return drive(ctxMap, gen).value;
}
