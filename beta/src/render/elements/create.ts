import type { AnyElement, TagNamespace } from "./namespaces";
import { childNamespace, HTML_NS } from "./namespaces";

export function createElement(parentNs: TagNamespace, tag: string): AnyElement {
  const namespace = childNamespace(parentNs, tag);
  return namespace === HTML_NS
    ? document.createElement(tag)
    : (document.createElementNS(namespace, tag) as AnyElement);
}
