import type { Context } from "../context";
import type { DependencyList } from "./types";

// ---------------------------------------------------------------------------
// Hook type constants — used as discriminants in descriptors and hook states
// ---------------------------------------------------------------------------

/** @internal */
export const $USE_STATE = "$USE_STATE" as const;
/** @internal */
export const $USE_REF = "$USE_REF" as const;
/** @internal */
export const $USE_ID = "$USE_ID" as const;
/** @internal */
export const $USE_MEMO = "$USE_MEMO" as const;
/** @internal */
export const $USE_EFFECT = "$USE_EFFECT" as const;
/** @internal */
export const $USE_CONTEXT = "$USE_CONTEXT" as const;
/** @internal */
export const $USE_RENDER = "$USE_RENDER" as const;
/** @internal */
export const $USE_RESOLVE = "$USE_RESOLVE" as const;
/** @internal */
export const $USE_RESOLVE_RAW = "$USE_RESOLVE_RAW" as const;
/** @internal */
export const $USE_SET_CONTEXT = "$USE_SET_CONTEXT" as const;

/** Union of all hook type string identifiers. */
export type HookType =
  | typeof $USE_STATE
  | typeof $USE_REF
  | typeof $USE_ID
  | typeof $USE_MEMO
  | typeof $USE_EFFECT
  | typeof $USE_CONTEXT
  | typeof $USE_RENDER
  | typeof $USE_RESOLVE
  | typeof $USE_RESOLVE_RAW
  | typeof $USE_SET_CONTEXT;

/**
 * Runtime set of all hook type strings for fast membership testing.
 * Used by `isHookDescriptor` to distinguish hook descriptors from VNodes.
 */
export const HOOK_TYPES: ReadonlySet<HookType> = new Set<HookType>([
  $USE_STATE,
  $USE_REF,
  $USE_ID,
  $USE_MEMO,
  $USE_EFFECT,
  $USE_CONTEXT,
  $USE_RENDER,
  $USE_RESOLVE,
  $USE_RESOLVE_RAW,
  $USE_SET_CONTEXT,
]);

// ---------------------------------------------------------------------------
// Descriptor interfaces — one per hook, yielded via `yield*` delegation
// ---------------------------------------------------------------------------

/** @internal */
export interface StateDescriptor {
  type: typeof $USE_STATE;
  initialValue: unknown;
}
/** @internal */
export interface RefDescriptor {
  type: typeof $USE_REF;
  initialValue: unknown;
}
/** @internal */
export interface IdDescriptor {
  type: typeof $USE_ID;
}
/** @internal */
export interface MemoDescriptor {
  type: typeof $USE_MEMO;
  fn: (...args: unknown[]) => unknown;
  deps: DependencyList;
}
/** @internal */
export interface EffectDescriptor {
  type: typeof $USE_EFFECT;
  fn: (signal: AbortSignal) => (() => void) | undefined;
  deps: DependencyList;
}
/** @internal */
export interface ContextDescriptor {
  type: typeof $USE_CONTEXT;
  ctx: Context;
  selector?: (ctx: unknown) => unknown[];
  transform?: (...args: unknown[]) => unknown;
}
/** @internal */
export interface RenderDescriptor {
  type: typeof $USE_RENDER;
  deps: DependencyList;
}
/** @internal */
export interface ResolveDescriptor {
  type: typeof $USE_RESOLVE;
  fn: (signal: AbortSignal) => Promise<unknown>;
  deps: DependencyList;
}
/** @internal */
export interface ResolveRawDescriptor {
  type: typeof $USE_RESOLVE_RAW;
  promise: Promise<unknown>;
}
/** @internal */
export interface SetContextDescriptor {
  type: typeof $USE_SET_CONTEXT;
  ctx: Context;
  value: unknown;
}

/**
 * Discriminated union of all hook descriptor types.
 *
 * Each hook generator yields one of these descriptors via `yield*` delegation.
 * The renderer's `runHooks` loop intercepts them and dispatches to the
 * appropriate handler in `processOneDescriptor`.
 */
export type HookDescriptor =
  | StateDescriptor
  | RefDescriptor
  | IdDescriptor
  | MemoDescriptor
  | EffectDescriptor
  | ContextDescriptor
  | RenderDescriptor
  | ResolveDescriptor
  | ResolveRawDescriptor
  | SetContextDescriptor;
