import type { SlotElement, TagNamespace } from "./namespaces";
import { childNamespace, HTML_NS } from "./namespaces";

export function createElement(parentNs: TagNamespace, tag: string): SlotElement {
  const namespace = childNamespace(parentNs, tag);
  return namespace === HTML_NS
    ? document.createElement(tag)
    : (document.createElementNS(namespace, tag) as SlotElement);
}
