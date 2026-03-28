/**
 * mount.ts — DOM construction from VNode trees.
 *
 * Builds real DOM nodes from VNodes: null/boolean → empty TextNode,
 * string/number → TextNode, Fragment/Portal → DocumentFragment,
 * components → via `mountComponent`, HTML elements → createElement.
 *
 * Components use end-marker Comment nodes as insertion anchors — no wrapper
 * `<span>` elements.
 */

import type { ContextEntry } from "../context";
import { type Child, Portal, RawFragment } from "../jsx";
import { mountComponent } from "./component";
import { driveWithContext, getContextMap, type RenderGenerator, setContext } from "./driver";
import { InvalidChildError } from "./errors";
import { isComponentNode, mergedProps, stripFrameworkDirectives } from "./helpers";
import { applyProps } from "./props";

/**
 * Build a single real DOM node from a VNode (or primitive).
 *
 * Handles null/boolean (empty TextNode), string/number (TextNode),
 * Fragment/Portal (DocumentFragment), components (via `mountComponent`),
 * and HTML elements.
 *
 * Returns a `DocumentFragment` for components (output nodes + endMarker).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode type dispatch with many branches
export function* buildNode(child: Child): RenderGenerator<Node> {
  if (child == null || typeof child === "boolean") {
    return document.createTextNode("");
  }
  if (typeof child === "string" || typeof child === "number") {
    return document.createTextNode(String(child));
  }
  if (!child.type) {
    throw new InvalidChildError(child);
  }
  const { $shown, $context } = child.props;
  if ($shown === false) return document.createTextNode("");
  if ($context) {
    const entries: ContextEntry[] = Array.isArray($context) ? $context : [$context];
    for (const entry of entries) {
      yield* setContext(entry.ctx, () => entry.value);
    }
  }

  const effectiveProps = isComponentNode(child) ? mergedProps(child) : child.props;
  const map = yield* getContextMap();

  if (child.type === Portal) {
    const portalContainer = child.props["$portalContainer"] as Element;
    for (const c of child.children) {
      portalContainer.appendChild(yield* driveWithContext(map, buildNode(c)));
    }
    return document.createComment("portal");
  }

  if (child.type === RawFragment) {
    const frag = document.createDocumentFragment();
    for (const c of child.children) {
      frag.appendChild(yield* driveWithContext(map, buildNode(c)));
    }
    return frag;
  }

  if (isComponentNode(child)) {
    const allProps = stripFrameworkDirectives(effectiveProps);
    return (yield* mountComponent(child.type, allProps)).fragment;
  }

  // HTML element
  const el = document.createElement(child.type as string);
  applyProps(el, child.props);
  for (const c of child.children) {
    el.appendChild(yield* driveWithContext(map, buildNode(c)));
  }
  return el;
}

export { mountComponent } from "./component";
