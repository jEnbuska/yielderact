// dom/svg-attrs.ts

import { SVG_NS, XLINK_NS } from "./namespaces";

/**
 * SVG attributes that are intrinsically camelCase and must NOT be kebab-cased
 * when written to the DOM. Everything else in SVG that arrives as JSX
 * camelCase converts to kebab-case (`textAnchor` → `text-anchor`).
 *
 * Sourced from the SVG 2 spec; see also React's DOMProperty tables.
 */
const SVG_CASED_ATTRS: ReadonlySet<string> = new Set([
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "clipPathUnits",
  "diffuseConstant",
  "edgeMode",
  "filterUnits",
  "glyphRef",
  "gradientTransform",
  "gradientUnits",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerUnits",
  "markerWidth",
  "maskContentUnits",
  "maskUnits",
  "numOctaves",
  "pathLength",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "preserveAspectRatio",
  "primitiveUnits",
  "refX",
  "refY",
  "repeatCount",
  "repeatDur",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan",
]);

/**
 * SVG attributes that live in the xlink namespace and require setAttributeNS.
 * Most are deprecated in SVG 2 in favour of plain attributes, but `xlinkHref`
 * is still common in older content.
 */
const SVG_XLINK_ATTRS: ReadonlySet<string> = new Set([
  "xlinkActuate",
  "xlinkArcrole",
  "xlinkHref",
  "xlinkRole",
  "xlinkShow",
  "xlinkTitle",
  "xlinkType",
]);

const camelToKebab = (s: string): string => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

export function isSvg(el: Element): el is SVGElement {
  return el.namespaceURI === SVG_NS;
}

/**
 * Translate a JSX-style camelCase prop name to the serialized SVG attribute
 * name. Allowlisted camelCase names pass through unchanged; xlink:* names
 * have their `xlink` prefix stripped because the namespace is supplied
 * separately via setAttributeNS.
 */
function svgAttrName(key: string): string {
  if (SVG_CASED_ATTRS.has(key)) return key;
  if (SVG_XLINK_ATTRS.has(key)) return camelToKebab(key.slice(5)); // "xlinkHref" → "href"
  return camelToKebab(key);
}

export function writeSvgAttr(el: SVGElement, key: string, value: unknown): void {
  if (SVG_XLINK_ATTRS.has(key)) {
    const local = svgAttrName(key);
    if (value == null) el.removeAttributeNS(XLINK_NS, local);
    else el.setAttributeNS(XLINK_NS, local, String(value));
  } else if (value === false || value == null) {
    el.removeAttribute(svgAttrName(key));
  } else {
    el.setAttribute(svgAttrName(key), String(value));
  }
}

export function clearSvgElementAttr(el: SVGElement, key: string): void {
  if (key === "className") el.removeAttribute("class");
  else if (SVG_XLINK_ATTRS.has(key)) el.removeAttributeNS(XLINK_NS, svgAttrName(key));
  else el.removeAttribute(svgAttrName(key));
}
