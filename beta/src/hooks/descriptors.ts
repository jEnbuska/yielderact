import type { Context } from "../context";

import type { DependencyList } from "yract-beta";

export const $STATE = "$STATE" as const;
export const $REF = "$REF" as const;
export const $WEAK_REF = "$WEAK_REF" as const;
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
  | typeof $WEAK_REF
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
  $WEAK_REF,
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

export interface WeakRefDescriptor {
  type: typeof $WEAK_REF;
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
  | WeakRefDescriptor
  | IdDescriptor
  | MemoDescriptor
  | StableDescriptor
  | EffectDescriptor
  | ContextDescriptor
  | BatchDescriptor;
