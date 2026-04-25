/**
 * applyElementProps / diffElementProps / updateElementProps.
 *
 * DOM is treated as a write-only sink — we never read `.className`,
 * `getAttribute`, `.value`, etc. The slot tree is the single source of
 * truth for what the DOM currently contains.
 *
 * Update path is split in two:
 *   1. `diffElementProps(prevProps, nextProps)` runs during reconcile.
 *      It produces an `ElementPatch | null` describing exactly the DOM
 *      operations needed — or `null` when nothing relevant changed.
 *      No DOM access.
 *   2. `updateElementProps(el, patch, delegationRoot)` runs at commit.
 *      It just consumes the patch: no diffing, no `Object.is`, no prev
 *      props needed.
 *
 * Unified rule: **`undefined` means "not passed"** for attrs, events,
 * and nested style keys. A key with `undefined` value is indistinguishable
 * from the key being absent, on either side.
 *
 * Validation: event-prop values must be `function | undefined`, `style`
 * must be `object | undefined`. Anything else throws from the diff (and
 * from the initial-mount writer) so programming mistakes surface loudly.
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

// ── Key classification ─────────────────────────────────────────────────────

/**
 * True for keys shaped like `on${UpperLetter}…` — matches the type-level
 * `on${Capitalize<EventName>}` convention produced by `EventHandlers`.
 * Rejects tokens like `once`/`online`/`onto` that happen to start with "on"
 * but aren't event handlers.
 *
 * Charcode test to avoid regex allocation on a hot reconcile path.
 */
function isEventKey(key: string): boolean {
  if (key.length < 3) return false;
  if (key.charCodeAt(0) !== 111 /* 'o' */) return false;
  if (key.charCodeAt(1) !== 110 /* 'n' */) return false;
  const c = key.charCodeAt(2);
  return c >= 65 && c <= 90; // 'A'..'Z'
}

function isReservedProp(key: string): boolean {
  switch (key) {
    case "key":
    case "deps":
    case "ref":
    case "shown":
    case "children":
      return true;
    default:
      return false;
  }
}

function isPlainStyleObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate that `value` is legal for `key`. `undefined` is always legal
 * (means "not passed"). Event keys require `function`. `style` requires a
 * plain object (not array, not string, not number, not boolean).
 */
function assertPropValue(key: string, value: unknown): void {
  if (value === undefined) return;
  if (isEventKey(key)) {
    if (typeof value !== "function") {
      throw new Error(
        `yract-beta: event prop "${key}" must be a function or undefined (got ${typeof value})`,
      );
    }
    return;
  }
  if (key === "style") {
    if (!isPlainStyleObject(value)) {
      const got = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
      throw new Error(`yract-beta: "style" prop must be a plain object or undefined (got ${got})`);
    }
  }
}

// ── Event registration helpers ─────────────────────────────────────────────

function registerElementEvent(
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

function unRegisterElementEvent(el: HTMLElement, propKey: string): void {
  const { domEvent, isCapture } = resolveEventProp(propKey);
  if (NON_DELEGATED_EVENTS.has(domEvent)) {
    removeNonDelegatedListener(el, domEvent);
  } else {
    unregisterHandler(el, domEvent, isCapture);
  }
}

/** Local shape for the `ref` prop — the universal `VNodeProps` type doesn't
 * declare `ref` (it lives on `HTMLAttributes`/`SVGAttributes` only), so the
 * runtime accesses it through this lightweight cast. */
export type RefLike = { current: unknown };

// ── Attribute writes ───────────────────────────────────────────────────────

function writeElementAttr(
  el: HTMLElement,
  key: string,
  value: unknown,
  delegationRoot: DelegationRoot,
): void {
  if (isEventKey(key) && typeof value === "function") {
    registerElementEvent(el, key, value as (e: SyntheticEvent) => void, delegationRoot);
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
  if (key === "style" && isPlainStyleObject(value)) {
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

function clearElementAttr(el: HTMLElement, key: string): void {
  if (key === "className") {
    el.className = "";
    return;
  }
  if (key === "htmlFor") {
    el.removeAttribute("for");
    return;
  }
  el.removeAttribute(key);
}

// ── Initial mount ───────────────────────────────────────────────────────────

export function applyElementProps(
  el: HTMLElement,
  props: VNodeProps,
  delegationRoot: DelegationRoot,
): void {
  for (const key in props) {
    if (!Object.hasOwn(props, key)) continue;
    if (isReservedProp(key)) continue;
    const value = props[key];
    if (value === undefined) continue;
    assertPropValue(key, value);
    writeElementAttr(el, key, value, delegationRoot);
  }
  const ref = props["ref"] as RefLike | undefined;
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

// ── Update: diff (at reconcile) + commit (at DOM write) ────────────────────

/**
 * Pre-computed DOM patch for an element whose props changed.
 *
 * Every field is optional — an empty patch shouldn't exist (the diff
 * returns `null` instead). The commit-phase writer iterates buckets in
 * order: `removeAttrs` → `removeEvents` → `style` → `setAttrs` →
 * `setEvents` → `refSwap`. The remove-before-set ordering matters for
 * event swaps between two different functions.
 *
 * `style === null` means "the whole style prop went away — clear inline
 * styles via `el.style.cssText = ""`". An object form carries per-property
 * writes — either a full replace (when prev had no style) or a delta
 * (when both sides had style objects). In the delta form, `""` values
 * clear individual style keys that went away.
 */
export interface ElementPatch {
  removeAttrs?: string[];
  setAttrs?: Record<string, unknown>;
  removeEvents?: string[];
  setEvents?: Record<string, (e: SyntheticEvent) => void>;
  style?: Record<string, unknown> | null;
  refSwap?: { prev?: RefLike; next?: RefLike };
}

/**
 * Build the per-key style patch when both prev and next are set objects.
 * Normalizes `undefined` style values to "unset" (the unified rule), so
 * the commit-writer only ever sees concrete values or `""` clears.
 */
function diffStyle(
  prevStyle: Record<string, unknown>,
  nextStyle: Record<string, unknown>,
): Record<string, unknown> | undefined {
  let styleDiff: Record<string, unknown> | undefined;

  for (const k in nextStyle) {
    if (!Object.hasOwn(nextStyle, k)) continue;
    const nv = nextStyle[k];
    const pv = prevStyle[k];
    if (nv === undefined) {
      if (pv !== undefined) (styleDiff ??= {})[k] = "";
      continue;
    }
    if (Object.is(nv, pv)) continue;
    (styleDiff ??= {})[k] = nv;
  }

  for (const k in prevStyle) {
    if (!Object.hasOwn(prevStyle, k)) continue;
    if (prevStyle[k] === undefined) continue;
    if (Object.hasOwn(nextStyle, k)) continue;
    (styleDiff ??= {})[k] = "";
  }

  return styleDiff;
}

/**
 * Walk prev+next props once and return a minimal `ElementPatch`, or `null`
 * when nothing observable changed. No DOM access.
 */
export function diffElementProps(
  prevProps: VNodeProps,
  nextProps: VNodeProps,
): ElementPatch | null {
  if (prevProps === nextProps) return null;

  let patch: ElementPatch | undefined;
  const ensure = (): ElementPatch => (patch ??= {});

  // Loop 1 — keys effectively set in prev but unset in next.
  for (const key in prevProps) {
    if (!Object.hasOwn(prevProps, key)) continue;
    if (isReservedProp(key)) continue;
    const prev = prevProps[key];
    if (prev === undefined) continue;
    const next = nextProps[key];
    if (next !== undefined) continue;

    assertPropValue(key, prev);

    if (key === "style") {
      ensure().style = null;
      continue;
    }
    if (isEventKey(key)) {
      (ensure().removeEvents ??= []).push(key);
      continue;
    }
    (ensure().removeAttrs ??= []).push(key);
  }

  // Loop 2 — keys effectively set in next with a different value than prev.
  for (const key in nextProps) {
    if (!Object.hasOwn(nextProps, key)) continue;
    if (isReservedProp(key)) continue;
    const next = nextProps[key];
    if (next === undefined) continue;
    const prev = prevProps[key];
    if (Object.is(next, prev)) continue;

    assertPropValue(key, next);
    if (prev !== undefined) assertPropValue(key, prev);

    if (key === "style") {
      if (prev === undefined) {
        ensure().style = next as Record<string, unknown>;
        continue;
      }
      const styleDiff = diffStyle(prev as Record<string, unknown>, next as Record<string, unknown>);
      if (styleDiff) ensure().style = styleDiff;
      continue;
    }

    if (isEventKey(key)) {
      if (typeof prev === "function") (ensure().removeEvents ??= []).push(key);
      (ensure().setEvents ??= {})[key] = next as (e: SyntheticEvent) => void;
      continue;
    }

    (ensure().setAttrs ??= {})[key] = next;
  }

  // Ref swap. `ref` is a reserved key skipped by the loops above; handled
  // here so refSwap is the only code path that touches refs. `undefined`
  // refs are treated as "unset" — `Object.is(undefined, undefined)` is true
  // so a prev-unset/next-unset transition never produces a swap.
  const prevRef = prevProps["ref"] as RefLike | undefined;
  const nextRef = nextProps["ref"] as RefLike | undefined;
  if (!Object.is(prevRef, nextRef)) {
    ensure().refSwap = { prev: prevRef, next: nextRef };
  }

  return patch ?? null;
}

/**
 * Apply a pre-computed `ElementPatch` to `el`. No diffing, no `Object.is`,
 * no access to the previous props — the caller has already decided what
 * needs to happen.
 */
export function updateElementProps(
  el: HTMLElement,
  patch: ElementPatch,
  delegationRoot: DelegationRoot,
): void {
  if (patch.removeAttrs) {
    for (const key of patch.removeAttrs) clearElementAttr(el, key);
  }
  if (patch.removeEvents) {
    for (const key of patch.removeEvents) unRegisterElementEvent(el, key);
  }
  if (patch.style === null) {
    el.style.cssText = "";
  } else if (patch.style) {
    Object.assign(el.style, patch.style);
  }
  if (patch.setAttrs) {
    for (const key in patch.setAttrs) {
      writeElementAttr(el, key, patch.setAttrs[key], delegationRoot);
    }
  }
  if (patch.setEvents) {
    for (const key in patch.setEvents) {
      registerElementEvent(el, key, patch.setEvents[key]!, delegationRoot);
    }
  }
  if (patch.refSwap) {
    const { prev, next } = patch.refSwap;
    if (prev) prev.current = undefined;
    if (next) next.current = el;
  }
}
