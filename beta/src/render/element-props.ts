/**
 * applyProps / updateProps — DOM writes only, never reads.
 *
 * Every diff is derived from the slot's previous `props` and the new
 * VNode's `props` — we never call `getAttribute`, `hasAttribute`,
 * `.className`-as-getter, `.value`-as-getter, etc. The DOM is treated as
 * a write-only sink. This keeps the slot tree as the single source of
 * truth for what the DOM currently contains.
 */
import type { SyntheticEvent } from "../events";
import type { VNodeProps } from "../jsx";
import {
  type DelegationRoot,
  NON_DELEGATED_EVENTS,
  registerHandler,
  resolveEventProp,
  unregisterHandler,
} from "./delegation";
import { addNonDelegatedListener, removeNonDelegatedListener } from "./events";

// ── Event registration helpers ─────────────────────────────────────────────

function registerEvent(
  el: HTMLElement,
  propKey: string,
  handler: (e: SyntheticEvent) => void,
  delegationRoot: DelegationRoot,
): void {
  const { domEvent, isCapture } = resolveEventProp(propKey);
  if (NON_DELEGATED_EVENTS.has(domEvent)) {
    addNonDelegatedListener(el, domEvent, handler);
  } else {
    registerHandler(el, domEvent, handler, isCapture);
    delegationRoot.ensureListening(domEvent);
  }
}

function unregisterEvent(el: HTMLElement, propKey: string): void {
  const { domEvent, isCapture } = resolveEventProp(propKey);
  if (NON_DELEGATED_EVENTS.has(domEvent)) {
    removeNonDelegatedListener(el, domEvent);
  } else {
    unregisterHandler(el, domEvent, isCapture);
  }
}

function isReservedProp(key: string): boolean {
  return key.startsWith("$");
}

/** Local shape for the `$ref` prop — the universal `VNodeProps` type doesn't
 * declare `$ref` (it lives on `HTMLAttributes`/`SVGAttributes` only), so the
 * runtime accesses it through this lightweight cast. */
export type RefLike = { current: unknown };

// ── Initial mount ───────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: prop type dispatch with many branches
function writeProp(
  el: HTMLElement,
  key: string,
  value: unknown,
  delegationRoot: DelegationRoot,
): void {
  if (key.startsWith("on") && typeof value === "function") {
    registerEvent(el, key, value as (e: SyntheticEvent) => void, delegationRoot);
    return;
  }
  if (key === "className") {
    el.className = value == null ? "" : String(value);
    return;
  }
  if (key === "htmlFor") {
    if (value == null) {
      el.removeAttribute("for");
    } else {
      el.setAttribute("for", String(value));
    }
    return;
  }
  if (key === "style" && typeof value === "object" && value !== null) {
    Object.assign(el.style, value);
    return;
  }
  if (
    key === "value" &&
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement)
  ) {
    el.value = value == null ? "" : String(value);
    return;
  }
  if (key === "checked" && el instanceof HTMLInputElement) {
    el.checked = Boolean(value);
    return;
  }
  if (value === false || value == null) {
    el.removeAttribute(key);
    return;
  }
  el.setAttribute(key, String(value));
}

function clearProp(el: HTMLElement, key: string, prevValue: unknown): void {
  if (key.startsWith("on") && typeof prevValue === "function") {
    unregisterEvent(el, key);
    return;
  }
  if (key === "className") {
    el.className = "";
    return;
  }
  if (key === "htmlFor") {
    el.removeAttribute("for");
    return;
  }
  if (key === "style") {
    el.removeAttribute("style");
    return;
  }
  el.removeAttribute(key);
}

export function applyProps(
  el: HTMLElement,
  props: VNodeProps,
  delegationRoot: DelegationRoot,
): void {
  for (const [key, value] of Object.entries(props)) {
    if (isReservedProp(key)) continue;
    writeProp(el, key, value, delegationRoot);
  }
  const ref = props["$ref"] as RefLike | undefined;
  if (ref) ref.current = el;

  // Derived-from-props defaults. No DOM reads.
  if (el instanceof HTMLButtonElement && props["type"] == null) {
    el.type = "button";
  }
  if (el instanceof HTMLAnchorElement && props["target"] === "_blank" && props["rel"] == null) {
    console.warn(
      'yract-beta: <a target="_blank"> is missing rel="noopener". ' +
        'Add rel="noopener noreferrer" to prevent tab-napping attacks.',
    );
  }
}

// ── Update (diff against previous props) ───────────────────────────────────

export function updateProps(
  el: HTMLElement,
  prevProps: VNodeProps,
  nextProps: VNodeProps,
  delegationRoot: DelegationRoot,
): void {
  // 1. Clear props that no longer exist
  for (const key in prevProps) {
    if (isReservedProp(key)) continue;
    if (key in nextProps) continue;
    clearProp(el, key, prevProps[key]);
  }

  // 2. Add or update props
  for (const key in nextProps) {
    if (isReservedProp(key)) continue;
    const next = nextProps[key];
    const prev = prevProps[key];
    if (Object.is(next, prev)) continue;

    if (key === "style" && typeof next === "object" && next !== null) {
      if (typeof prev === "object" && prev !== null) {
        for (const styleProp in prev as Record<string, unknown>) {
          if (!(styleProp in (next as Record<string, unknown>))) {
            el.style[styleProp as never] = "";
          }
        }
      }
      Object.assign(el.style, next);
      continue;
    }

    if (key.startsWith("on") && typeof next === "function") {
      if (typeof prev === "function") unregisterEvent(el, key);
      registerEvent(el, key, next as (e: SyntheticEvent) => void, delegationRoot);
      continue;
    }

    writeProp(el, key, next, delegationRoot);
  }

  // 3. Ref swap
  const prevRef = prevProps["$ref"] as RefLike | undefined;
  const nextRef = nextProps["$ref"] as RefLike | undefined;
  if (!Object.is(prevRef, nextRef)) {
    if (prevRef) prevRef.current = undefined;
    if (nextRef) nextRef.current = el;
  }
}
