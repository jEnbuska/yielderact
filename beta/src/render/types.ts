import type { ContextProperties } from "../context";
import type { ContextHookState } from "../hooks/context";
import type { $EFFECT, $ID, $MEMO, $REF, $STABLE, $STATE, $WEAK_REF } from "../hooks/descriptors";
import type { DelegationRoot } from "./delegation";
import type { Scheduler } from "./scheduler";
import type { DependencyList } from "yract-beta";

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

export interface WeakRefHookState {
  type: typeof $WEAK_REF;
  get current(): WeakKey | undefined;
  set current(value: WeakKey);
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

export type HookState =
  | StateHookState
  | RefHookState
  | IdHookState
  | MemoHookState
  | StableHookState
  | EffectHookState
  | ContextHookState
  | WeakRefHookState;
