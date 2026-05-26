export const HTML_NS = "http://www.w3.org/1999/xhtml" as const;
export const SVG_NS = "http://www.w3.org/2000/svg" as const;
const MATHML_NS = "http://www.w3.org/1998/Math/MathML" as const;
export const XLINK_NS = "http://www.w3.org/1999/xlink" as const;

export type TagNamespace = typeof HTML_NS | typeof SVG_NS | typeof MATHML_NS;

/**
 * Compute the namespace a child element should be created in, given the
 * current (parent) namespace and the child's tag name.
 *
 * Rules:
 *  - <svg> always enters the SVG namespace, regardless of parent.
 *  - <math> always enters the MathML namespace.
 *  - Inside SVG, <foreignObject>'s children flip back to HTML — this is the
 *    documented escape hatch for embedding HTML inside SVG.
 *  - Otherwise the parent namespace is inherited.
 *
 * NOTE: foreignObject re-entry is checked against `parentNs`, not the tag's
 * own namespace — so the *children* of foreignObject are HTML; foreignObject
 * itself is still SVG.
 */
export function childNamespace(parentNs: TagNamespace, tag: string): TagNamespace {
  if (tag === "svg") return SVG_NS;
  if (tag === "math") return MATHML_NS;
  if (parentNs === SVG_NS && tag === "foreignObject") return HTML_NS;
  return parentNs;
}

export function nodeNameSpace(element: Element) {
  return element.namespaceURI as TagNamespace;
}

export type AnyElement = HTMLElement | SVGElement | MathMLElement;
