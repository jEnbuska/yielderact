import type { Context } from "../context";

import type { DependencyList } from "yract";
import type { Child } from "../jsx";
import type {
  $$FORCE_UPDATE,
  $$HALT,
  $$HALTED,
  $$RENDER,
  $CONTEXT,
  $EFFECT,
  $ID,
  $LOAD,
  $MEMO,
  $REF,
  $STABLE,
  $STATE,
  $WEAK_REF,
} from "./constants";
import { hookTypes } from "./constants";

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

export interface WeakRefDescriptor<T extends WeakKey = WeakKey> {
  type: typeof $WEAK_REF;
  initial?: T;
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

export interface LoadDescriptor {
  type: typeof $LOAD;
  promise?: Promise<any>;
}

export interface RenderDescriptor {
  type: typeof $$RENDER;
  child: Child;
}

export interface HaltDescriptor {
  type: typeof $$HALT;
  initialFallback?: Child;
}

export interface HaltedDescriptor {
  type: typeof $$HALTED;
}
export interface ForceUpdateDescriptor {
  type: typeof $$FORCE_UPDATE;
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
  | LoadDescriptor
  | RenderDescriptor
  | HaltDescriptor
  | HaltedDescriptor
  | ForceUpdateDescriptor;
