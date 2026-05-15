/**
 * hooks/utils — shared dependency comparison and the central hook
 * descriptor dispatcher.
 *
 * `depsChanged` is the shallow `Object.is` comparison every dep-checking
 * hook uses.
 *
 * `processOneDescriptor` is the dispatcher driven by `BaseInstance.doRender()`.
 * Each yielded hook descriptor is routed to the matching `process*` helper,
 * the resulting state is written back into the instance's `hookStates`, and
 * the value to feed back into `gen.next(...)` is returned.
 *
 * Each `process*` helper is a pure state transition. Side effects (running
 * effects, subscribing to contexts, aborting on unmount) are handled by
 * `BaseInstance.afterRender()` / `BaseInstance.unmount()`, which walk
 * `hookStates` after the render completes.
 */
import type { BaseInstance } from "../instances/base-instance";
import type { HookState } from "../render/types";
import { getContextValue, processContext } from "./context";
import {
  $CONTEXT,
  $EFFECT,
  $ID,
  $MEMO,
  $REF,
  $STABLE,
  $STATE,
  HOOK_TYPES,
  type HookDescriptor,
  type HookType,
} from "./descriptors";
import { processEffect } from "./effect";
import { processId } from "./id";
import { processMemo } from "./memo";
import { processRef } from "./ref";
import { processStable } from "./stable";
import { createStateSetter, processState } from "./state";
import type { DependencyList } from "./types";

/** Returns true when the dependency arrays differ (shallow `Object.is` comparison). */
export function depsChanged(
  prev: DependencyList | undefined,
  next: DependencyList | undefined,
): boolean {
  if (prev === undefined || next === undefined) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

/** True when `value` looks like a yielded hook descriptor. */
export function isHookDescriptor(value: unknown): value is HookDescriptor {
  if (value == null || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string") return false;
  return HOOK_TYPES.has(type as HookType);
}

function getTypedPrev<K extends HookState["type"]>(
  hookStates: HookState[],
  hookIndex: number,
  expectedType: K,
  instance: BaseInstance,
): Extract<HookState, { type: K }> | undefined {
  const prev = hookStates[hookIndex];
  if (prev === undefined) return undefined;
  if (prev.type !== expectedType) {
    throw new Error(
      `yract-beta: hook order mismatch in ${instance.debugLabel()} at index ${hookIndex}: ` +
        `expected ${prev.type} (from previous render) but got ${expectedType}. ` +
        `Hooks must be called in the same order on every render.`,
    );
  }
  return prev as Extract<HookState, { type: K }>;
}

/**
 * Dispatch one hook descriptor, store its persistent state on the instance,
 * and return the value to feed back into `gen.next(...)`.
 */
export function processOneDescriptor(
  descriptor: Exclude<HookDescriptor, { type: `$$${string}` }>,
  hookIndex: number,
  instance: BaseInstance,
): unknown {
  const hookStates = instance.hookStates!;
  switch (descriptor.type) {
    case $STATE: {
      const prev = getTypedPrev(hookStates, hookIndex, $STATE, instance);
      const state = processState(descriptor, prev);
      hookStates[hookIndex] = state;
      return [state.value, createStateSetter(instance, state)];
    }
    case $REF: {
      const prev = getTypedPrev(hookStates, hookIndex, $REF, instance);
      const state = processRef(descriptor, prev);
      hookStates[hookIndex] = state;
      return state;
    }
    case $ID: {
      const prev = getTypedPrev(hookStates, hookIndex, $ID, instance);
      const state = processId(prev);
      hookStates[hookIndex] = state;
      return state.id;
    }
    case $MEMO: {
      const prev = getTypedPrev(hookStates, hookIndex, $MEMO, instance);
      const state = processMemo(descriptor, prev);
      hookStates[hookIndex] = state;
      return state.value;
    }
    case $STABLE: {
      const prev = getTypedPrev(hookStates, hookIndex, $STABLE, instance);
      const state = processStable(descriptor, prev);
      hookStates[hookIndex] = state;
      return state.stable;
    }
    case $EFFECT: {
      const prev = getTypedPrev(hookStates, hookIndex, $EFFECT, instance);
      hookStates[hookIndex] = processEffect(instance, descriptor, prev);
      return;
    }
    case $CONTEXT: {
      const prev = getTypedPrev(hookStates, hookIndex, $CONTEXT, instance);
      const state = processContext(instance, descriptor, prev);
      hookStates[hookIndex] = state;
      return getContextValue(state, instance);
    }
    default: {
      const _exhaustive: never = descriptor;
      throw new Error(
        `yract-beta: unknown hook descriptor type ${String((_exhaustive as { type?: unknown })?.type ?? _exhaustive)}`,
      );
    }
  }
}
