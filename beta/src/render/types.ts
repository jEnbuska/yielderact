import type { ContextProperties } from "../context";
import type { ContextHookState } from "../hooks/context";
import type { DelegationRoot } from "./delegation";
import type { Scheduler } from "./scheduler";
import type { DependencyList } from "yract-beta";
import { $EFFECT, $ID, $LOAD, $MEMO, $REF, $STABLE, $STATE, $WEAK_REF } from "../hooks/constants";
import { WeakRefLike } from "./element-props";

export type ContextMap = Map<string, ContextProperties<unknown>>;

export interface RenderContext {
  container: Element;
  scheduler: Scheduler;
  delegationRoot: DelegationRoot;
}
export interface StateHookState {
  type: typeof $STATE;
  value: unknown;
  deps: DependencyList;
  pendingValue: unknown;
  identifier: symbol;
  pendingResolve?: () => void;
}

export interface RefHookState {
  type: typeof $REF;
  current: unknown;
}

export interface WeakRefHookState<T extends WeakKey = WeakKey> {
  type: typeof $WEAK_REF;
  ref: WeakRefLike<T>;
}

export interface IdHookState {
  type: typeof $ID;
  id: string;
}

export interface MemoHookState {
  type: typeof $MEMO;
  value: unknown;
  deps: DependencyList;
}

export interface StableHookState {
  type: typeof $STABLE;
  current: (...args: unknown[]) => unknown;
  stable: unknown;
}

export interface EffectHookState {
  type: typeof $EFFECT;
  deps: DependencyList;
  identifier: symbol;
  fn: () => void | (() => void);
  controller?: AbortController;
  dirty?: boolean;
}

export interface LoadState<T, TError = Error> {
  type: typeof $LOAD;
  promise?: Promise<T>;
  error?: TError;
  identifier: symbol;
  data?: T;
  loading: boolean;
}

export type HookState =
  | StateHookState
  | RefHookState
  | IdHookState
  | MemoHookState
  | StableHookState
  | EffectHookState
  | ContextHookState
  | WeakRefHookState
  | LoadState<any>;
