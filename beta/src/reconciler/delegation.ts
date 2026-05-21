import type { VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";
import type { BaseInstance } from "../instances/base-instance";
import type { ComponentSlotType, ContextSlotType, SlotIntent } from "../slots/slot";

export type DelegateMount = {
  type: "MOUNT";
  intent: SlotIntent<ComponentSlotType | ContextSlotType>;
  parentDom: Node;
  ns: TagNamespace;
};
export type DelegateUI = { type: "UI"; callback: () => void };
export type DelegateRef = { type: "REF"; ref: RefLike; element: SlotElement };
export type DelegationAction = DelegateMount | DelegateUI | DelegateProps | DelegateRef;
export type DelegateProps = {
  type: "PROPS";
  instance: BaseInstance;
  props: VNodeProps;
};

export function isRefProps<T extends VNodeProps>(props: T): props is T & { ref: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function deferRef(element: SlotElement, ref: RefLike): DelegateRef {
  return {
    type: "REF",
    ref,
    element,
  };
}

export function deferUi(callback: () => unknown): DelegateUI {
  return {
    type: "UI",
    callback,
  };
}

export function delegateMount(
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  ns: TagNamespace,
): DelegateMount {
  return {
    type: "MOUNT",
    intent,
    parentDom,
    ns,
  };
}

export function delegateProps(instance: BaseInstance, props: VNodeProps): DelegateProps {
  return {
    type: "PROPS",
    instance,
    props,
  };
}
