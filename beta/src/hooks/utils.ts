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
import type { ComponentFiber } from "../instances/component-fiber";
import type { HookState } from "../render/types";
import { getContextValue, processContext } from "./context";
import { HOOK_TYPES, type HookDescriptor, type HookType } from "./types";
import { processEffect } from "./effect";
import { processId } from "./id";
import { processMemo } from "./memo";
import { processRef } from "./ref";
import { processStable } from "./stable";
import { createStateSetter, processState } from "./state";
import { processWeakRef } from "./weakRef";
import type { Child } from "../jsx";
import type { ComponentGenerator } from "../general-types";
import { HookRuleError } from "./HookRuleError";
import { processLoad } from "./load";
import {
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

/** True when `value` looks like a yielded hook descriptor. */
function isHookDescriptor(value: unknown): value is HookDescriptor {
  if (value == null || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string") return false;
  return HOOK_TYPES.has(type as HookType);
}

function getTypedPrev<K extends HookState["type"]>(
  hookStates: HookState[],
  hookIndex: number,
  expectedType: K,
  instance: ComponentFiber,
): Extract<HookState, { type: K }> | undefined {
  const prev = hookStates[hookIndex];
  if (prev === undefined) return undefined;
  if (prev.type !== expectedType) {
    throw new HookRuleError(
      instance,
      `Hook order mismatch at index ${hookIndex}: ` +
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
function processOneDescriptor(
  descriptor: Exclude<HookDescriptor, { type: `$$${string}` }>,
  hookIndex: number,
  instance: ComponentFiber,
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
    case $WEAK_REF: {
      const prev = getTypedPrev(hookStates, hookIndex, $WEAK_REF, instance);
      const state = processWeakRef(prev);
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
    case $LOAD: {
      const prev = getTypedPrev(hookStates, hookIndex, $LOAD, instance);
      const state = processLoad(instance, descriptor, prev);
      hookStates[hookIndex] = state;
      return state;
    }
    default: {
      const _exhaustive: never = descriptor;
      throw new Error(
        `yract-beta: unknown hook descriptor type ${String((_exhaustive as { type?: unknown })?.type ?? _exhaustive)}`,
      );
    }
  }
}

export function runHooks(gen: ComponentGenerator<any>, instance: ComponentFiber): Child {
  let hookIndex = 0;
  let step = gen.next();
  if (step.done) return step.value;
  instance.hookStates ??= [];
  instance.halted = false;
  while (!step.done) {
    const value = step.value;

    if (!isHookDescriptor(value)) {
      setupSkippedHookCleanups(instance, hookIndex);
      return value as Child;
    }
    switch (value.type) {
      case $$FORCE_UPDATE: {
        step = gen.next(() => instance.scheduleRender(Symbol("FORCE_UPDATE")));
        break;
      }
      case $$HALTED: {
        step = gen.next({
          get current(): boolean {
            let parent: ComponentFiber | null = instance;
            while (parent) {
              if (parent.halted) return true;
              parent = parent.parent;
            }
            return false;
          },
        });
        break;
      }
      case $$HALT: {
        instance.halted = true;
        if (!instance.rendered) return value.initialFallback;
        return instance.prevChild;
      }
      case $$RENDER: {
        setupSkippedHookCleanups(instance, hookIndex);
        return value.child;
      }
      default: {
        const result = processOneDescriptor(value, hookIndex, instance);
        hookIndex++;
        step = gen.next(result);
        break;
      }
    }
  }
  setupSkippedHookCleanups(instance, hookIndex);
  return step.value;
}

function setupSkippedHookCleanups(instance: ComponentFiber, hookIndex: number) {
  const hookStates = instance.hookStates!;
  if (hookIndex >= hookStates.length) return;
  for (let i = hookIndex; i < hookStates.length; i++) {
    const hook = hookStates[i]!;
    switch (hook.type) {
      case $EFFECT:
        hook.dirty = true;
        hook.fn = () => {};
        break;
      case $CONTEXT:
        hook.unsubscribe?.();
    }
  }

  instance.scheduleEffect(Symbol("BREAK"));

  const controller = new AbortController();
  hookStates.push({
    controller,
    dirty: true,
    type: $EFFECT,
    fn: () => {},
    deps: [],
    identifier: Symbol("CLEANUP"),
  });
  controller.signal.onabort = () => {
    hookStates.splice(hookIndex);
  };
}
