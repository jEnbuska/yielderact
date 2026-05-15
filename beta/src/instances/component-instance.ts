/**
 * ComponentInstance — a mounted generator component.
 *
 * Holds hook state, child instances, and slot tree for one generator
 * component. On `doRender()` it runs the generator body, dispatches
 * yielded hook descriptors, and reconciles the final output against its
 * existing slot tree between `startAnchor` and `endAnchor`.
 */
import { isHookDescriptor, processOneDescriptor } from "../hooks/utils";
import type { Component, SingleChild } from "../jsx";
import { BaseInstance } from "./base-instance";
import { $$BATCH, $$INSTANCE } from "../hooks/descriptors";
import type { OptionalDelegationAction } from "../reconciler/types";
import type { Slot } from "../slots/slot";

export class ComponentInstance extends BaseInstance<Component> {
  protected override render(
    props: Record<string, unknown>,
  ): Generator<OptionalDelegationAction, { slot: Slot; key: string }, BaseInstance> {
    const fn = this.vnode.type as Component<Record<string, any>>;
    if (typeof fn !== "function") {
      throw new Error(
        `yract-beta: ComponentInstance.render called for non-function type ${String(fn)}`,
      );
    }
    const child = this.runHooks(fn(props));
    return this.reconcile(child);
  }

  _handleBatch?: <T>(callback: () => T) => Promise<T>;

  private runHooks(gen: Generator<unknown, SingleChild, unknown>): SingleChild {
    let hookIndex = 0;
    let step = gen.next();
    if (step.done) return step.value;
    this.hookStates = [];
    while (!step.done) {
      const value = step.value;
      if (!isHookDescriptor(value)) {
        return value as SingleChild;
      }
      switch (value.type) {
        case $$INSTANCE: {
          step = gen.next(this);
          break;
        }
        case $$BATCH: {
          this._handleBatch ??= async <T>(callback: () => T): Promise<T> => {
            try {
              this.rctx.scheduler.beginBatch();
              return await callback();
            } finally {
              this.rctx.scheduler.endBatch();
            }
          };
          step = gen.next(this._handleBatch);
          break;
        }
        default: {
          const result = processOneDescriptor(value, hookIndex, this);
          hookIndex++;
          step = gen.next(result);
          break;
        }
      }
    }
    return step.value;
  }
}
