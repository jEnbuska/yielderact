/**
 * ComponentInstance — a mounted generator component.
 *
 * Holds hook state, child instances, and slot tree for one generator
 * component. On `doRender()` it runs the generator body, dispatches
 * yielded hook descriptors, and reconciles the final output against its
 * existing slot tree between `startAnchor` and `endAnchor`.
 */
import { isHookDescriptor, processOneDescriptor } from "../hooks/utils";
import type { Child, VNodeProps } from "../jsx";
import { reconcileChildren } from "../render/reconciler";
import { BaseInstance } from "./base-instance";

/**
 * Strip framework-only props (`$key`, `$shown`) before passing to the
 * component generator. These are consumed by the framework (reconciler /
 * conditional mount) and components do not see them in their `props`
 * argument. Returns the original object when neither prop is present, to
 * avoid an allocation in the common case.
 */
function stripFrameworkProps(props: VNodeProps): VNodeProps {
  if (!("$key" in props) && !("$shown" in props)) return props;
  const { $key: _k, $shown: _s, ...rest } = props;
  return rest as VNodeProps;
}

export class ComponentInstance extends BaseInstance {
  protected doRender(): void {
    this.applyPendingProps();

    const fn = this.vnode.type;
    if (typeof fn !== "function") {
      throw new Error(
        `yract-beta: ComponentInstance.render called for non-function type ${String(fn)}`,
      );
    }

    const output = this.runGenerator(fn as (p: unknown) => Generator<unknown, Child, unknown>);

    const parentDom = this.startAnchor.parentNode;
    if (!parentDom) {
      throw new Error("yract-beta: ComponentInstance rendered with detached startAnchor");
    }

    this.slots = reconcileChildren(
      this,
      parentDom,
      this.slots,
      [output],
      this.endAnchor,
    );
  }

  private runGenerator(fn: (props: unknown) => Generator<unknown, Child, unknown>): Child {
    const rerender = (): Promise<void> => {
      this.scheduleRender();
      return Promise.resolve();
    };

    const gen = fn(stripFrameworkProps(this.props));
    let hookIndex = 0;
    let step = gen.next();
    while (!step.done) {
      const value = step.value;
      if (isHookDescriptor(value)) {
        const result = processOneDescriptor(value, hookIndex, this, rerender);
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
