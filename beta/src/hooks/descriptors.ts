import type { Context } from "../context";
import type { DependencyList } from "./types";

export const $STATE = "$STATE" as const;
export const $REF = "$REF" as const;
export const $ID = "$ID" as const;
export const $MEMO = "$MEMO" as const;
export const $STABLE = "$STABLE" as const;
export const $EFFECT = "$EFFECT" as const;
export const $CONTEXT = "$CONTEXT" as const;
export const $$BATCH = "$$BATCH" as const;

export type HookType =
  | typeof $STATE
  | typeof $REF
  | typeof $ID
  | typeof $MEMO
  | typeof $STABLE
  | typeof $EFFECT
  | typeof $CONTEXT
  | typeof $$BATCH;

export const HOOK_TYPES: ReadonlySet<HookType> = new Set<HookType>([
  $STATE,
  $REF,
  $ID,
  $MEMO,
  $STABLE,
  $EFFECT,
  $CONTEXT,
  $$BATCH,
]);

export interface StateDescriptor {
  type: typeof $STATE;
  initialValue: unknown;
  deps: DependencyList;
}

export interface RefDescriptor {
  type: typeof $REF;
  initialValue: unknown;
}

export interface IdDescriptor {
  type: typeof $ID;
}

export interface MemoDescriptor {
  type: typeof $MEMO;
  fn: (...args: unknown[]) => unknown;
  deps: DependencyList;
}

export interface StableDescriptor {
  type: typeof $STABLE;
  fn: (...args: unknown[]) => unknown;
}

export interface EffectDescriptor {
  type: typeof $EFFECT;
  fn: (signal: AbortSignal) => void | Promise<void>;
  deps: DependencyList;
}

export interface ContextDescriptor {
  type: typeof $CONTEXT;
  ctx: Context;
  depsSelector?: (ctx: unknown) => unknown[];
  transform?: (...args: unknown[]) => unknown;
}

export interface BatchDescriptor {
  type: typeof $$BATCH;
}

export type HookDescriptor =
  | StateDescriptor
  | RefDescriptor
  | IdDescriptor
  | MemoDescriptor
  | StableDescriptor
  | EffectDescriptor
  | ContextDescriptor
  | InstanceDescriptor
  | BatchDescriptor;
