import type { Context } from "../context";
import type { ContextHookState } from "../hooks/context";
import type { $$BATCH, $EFFECT, $ID, $MEMO, $REF, $STABLE, $STATE } from "../hooks/descriptors";
import type { DependencyList } from "../hooks/types";
import type { DelegationRoot } from "./delegation";
import type { Scheduler } from "./scheduler";

// ---------------------------------------------------------------------------
// Context map — immutable map threaded through the instance tree
// ---------------------------------------------------------------------------

export type ContextMap = ReadonlyMap<Context, unknown>;

// ---------------------------------------------------------------------------
// Per-root render context — one per createRoot(), not stored in ContextMap.
// Each BaseInstance holds a direct reference via `rctx`.
// ---------------------------------------------------------------------------

export interface RenderContext {
  container: Element;
  scheduler: Scheduler;
  delegationRoot: DelegationRoot;
}

// ---------------------------------------------------------------------------
// Hook state discriminated union (`type` as discriminant)
// ---------------------------------------------------------------------------

export interface StateHookState {
  type: typeof $STATE;
  value: unknown;
  deps: DependencyList;
  pendingValue: unknown;
  identifier: symbol;
  /** Resolve function for the latest setState promise. No-op when no setState is pending. */
  pendingResolve?: () => void;
}

export interface RefHookState {
  type: typeof $REF;
  current: unknown;
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
  fn: (signal: AbortSignal) => void | Promise<void>;
  controller?: AbortController;
  dirty?: boolean;
}

export interface BatchHookState {
  type: typeof $$BATCH;
  value: <T>(callback: () => T) => Awaited<T>;
}

export type HookState =
  | StateHookState
  | RefHookState
  | IdHookState
  | MemoHookState
  | StableHookState
  | EffectHookState
  | ContextHookState
  | BatchHookState;
