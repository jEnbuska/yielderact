/**
 * ComponentInstance — a mounted generator component.
 *
 * Holds hook state, child instances, and slot tree for one generator
 * component. On `doRender()` it runs the generator body, dispatches
 * yielded hook descriptors, and reconciles the final output against its
 * existing slot tree between `startAnchor` and `endAnchor`.
 */
import { isHookDescriptor, processOneDescriptor } from "../hooks/utils";
import type { Child, Component } from "../jsx";
import { reconcile } from "../reconciler/reconciler";
import { BaseInstance } from "./base-instance";
import { $$BATCH, $$INSTANCE } from "../hooks/descriptors";
import type { OptionalUpdateResult, ReconcileResult } from "../reconciler/types";

export class ComponentInstance extends BaseInstance<Component> {
  protected render(
    props: Record<string, unknown>,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
    const fn = this.vnode.type as Component<Record<string, any>>;
    if (typeof fn !== "function") {
      throw new Error(
        `yract-beta: ComponentInstance.render called for non-function type ${String(fn)}`,
      );
    }
    const output = this.runGenerator(fn(props));
    return reconcile([output], this, this.parentDom, this.endAnchor, "", this.slots, this.keyIndex);
  }

  private runGenerator(gen: Generator<unknown, Child, unknown>): Child {
    let hookIndex = 0;
    let step = gen.next();
    while (!step.done) {
      const value = step.value;
      if (!isHookDescriptor(value)) {
        return value as Child;
      }
      switch (value.type) {
        case $$INSTANCE: {
          step = gen.next(this);
          break;
        }
        case $$BATCH: {
          step = gen.next(this.handleBatch);
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
