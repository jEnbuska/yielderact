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
import { type AnyCallbackResult, applyCallbacks, reconcile } from "../render/reconciler";
import { BaseInstance } from "./base-instance";

export class ComponentInstance extends BaseInstance<Component> {
  protected doRender(): void {
    this.applyPendingProps();

    const fn = this.vnode.type;
    if (typeof fn !== "function") {
      throw new Error(
        `yract-beta: ComponentInstance.render called for non-function type ${String(fn)}`,
      );
    }

    const output = this.runGenerator(fn(this.props));

    const parentDom = this.startAnchor.parentNode;
    if (!parentDom) {
      throw new Error("yract-beta: ComponentInstance rendered with detached startAnchor");
    }

    const gen = reconcile([output], this, parentDom, this.endAnchor, this.slots, this.keyIndex);
    const callbacks: AnyCallbackResult[] = [];
    let result = gen.next();
    while (!result.done) {
      callbacks.push(result.value);
      result = gen.next();
    }
    const { slots, keyIndex } = result.value;
    this.slots = slots;
    this.keyIndex = keyIndex;
    applyCallbacks(callbacks);
  }

  private runGenerator(gen: Generator<unknown, Child, unknown>): Child {
    let hookIndex = 0;
    let step = gen.next();
    while (!step.done) {
      const value = step.value;
      if (isHookDescriptor(value)) {
        const result = processOneDescriptor(value, hookIndex, this);
        hookIndex++;
        step = gen.next(result);
        continue;
      }
      // Non-descriptor yield — treat it as the final output.
      return value as Child;
    }
    return step.value;
  }
}
