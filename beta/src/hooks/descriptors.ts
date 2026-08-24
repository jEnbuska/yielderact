import type { Context } from "../context";

import type { DependencyList } from "yract-beta";
import type { Child } from "../jsx";

export const $STATE = "$STATE" as const;
export const $REF = "$REF" as const;
export const $WEAK_REF = "$WEAK_REF" as const;
export const $ID = "$ID" as const;
export const $MEMO = "$MEMO" as const;
export const $STABLE = "$STABLE" as const;
export const $EFFECT = "$EFFECT" as const;
export const $CONTEXT = "$CONTEXT" as const;
export const $$AWAIT = "$$AWAIT" as const;
export const $$RENDER = "$$RENDER" as const;
export const $$HALT = "$$HALT" as const;
export const $$INERT = "$$INERT" as const;

const hookTypes = [
  $STATE,
  $REF,
  $ID,
  $MEMO,
  $STABLE,
  $EFFECT,
  $CONTEXT,
  $WEAK_REF,
  $$AWAIT,
  $$RENDER,
  $$HALT,
  $$INERT,
] as const;

export type HookType = (typeof hookTypes)[number];

export const HOOK_TYPES: ReadonlySet<HookType> = new Set<HookType>(hookTypes);

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
  fn: () => void | (() => void);
  deps: DependencyList;
}

export interface ContextDescriptor {
  type: typeof $CONTEXT;
  ctx: Context;
  depsSelector?: (ctx: unknown) => unknown[];
  transform?: (...args: unknown[]) => unknown;
}

export interface AwaitDescriptor {
  type: typeof $$AWAIT;
  promise: Promise<any>;
  initial?: Child;
}

export interface RenderDescriptor {
  type: typeof $$RENDER;
  child: Child;
}

export interface HaltDescriptor {
  type: typeof $$HALT;
  initialFallback?: Child;
}

export interface InertDescriptor {
  type: typeof $$INERT;
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
  | AwaitDescriptor
  | RenderDescriptor
  | HaltDescriptor
  | InertDescriptor;
