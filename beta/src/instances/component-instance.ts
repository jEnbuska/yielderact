/**
 * ComponentInstance — a mounted generator component.
 *
 * Holds hook state, child instances, and slot tree for one generator
 * component. On `doRender()` it runs the generator body, dispatches
 * yielded hook descriptors, and reconciles the final output against its
 * existing slot tree between `startAnchor` and `endAnchor`.
 */
import { isHookDescriptor, processOneDescriptor } from "../hooks/utils";
import type { Child, Component, VNodeProps } from "../jsx";
import { BaseInstance } from "./base-instance";
import { $$BATCH } from "../hooks/descriptors";
import type { Slot } from "../slots/slot";
import type { DelegationAction } from "../reconciler/delegation";

export class ComponentInstance extends BaseInstance {
  protected override render(props: VNodeProps): Generator<DelegationAction, Slot, BaseInstance> {
    const fn = this.vnode.type as Component<Record<string, any>>;
    const child = this.runHooks(fn(props));
    return this.reconcile(child);
  }

  _handleBatch?: <T>(callback: () => T) => Promise<T>;

  private runHooks(gen: Generator<unknown, Child, unknown>): Child {
    let hookIndex = 0;
    let step = gen.next();
    if (step.done) return step.value;
    this.hookStates ??= [];
    while (!step.done) {
      const value = step.value;
      if (!isHookDescriptor(value)) {
        return value as Child;
      }
      switch (value.type) {
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
