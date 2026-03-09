import { type SyntheticEvent } from '../events';
import { addSyntheticListener, removeSyntheticListener } from './events';

// ── Ref helpers ─────────────────────────────────────────────────────────────

/** Attach a $ref (callback or object) to a DOM element. */
export function setRef(ref: unknown, el: Element): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    (ref as (instance: Element | null) => void)(el);
  } else if (typeof ref === 'object' && 'current' in (ref as object)) {
    (ref as { current: unknown }).current = el;
  }
}

/** Clear a $ref (callback with null, or set .current to null). */
export function clearRef(ref: unknown): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    (ref as (instance: Element | null) => void)(null);
  } else if (typeof ref === 'object' && 'current' in (ref as object)) {
    (ref as { current: unknown }).current = null;
  }
}

// ── Prop application ────────────────────────────────────────────────────────

/**
 * Apply all of a VNode's props to a freshly-created DOM element.
 *
 * This is the **initial mount** path — every prop is set unconditionally.
 * For subsequent updates where only changed props should be touched, see
 * `updateProps` below.
 *
 * **Called by:**
 * - `buildVNodeList` in `mount.ts` — when building an HTML element during
 *   initial mount.
 * - `reconcileOne` in `reconciler.ts` — when a different tag is encountered
 *   and a fresh element is created.
 *
 * **Prop handling rules:**
 * - All `$`-prefixed props are skipped (framework-internal special props).
 * - `onXxx` props → `addSyntheticListener(el, eventName, handler)`.
 * - `className` → `el.className`.
 * - `htmlFor` → `el.setAttribute('for', …)`.
 * - `style` (object) → `Object.assign(el.style, …)`.
 * - `value` on input/textarea/select → DOM property (not attribute).
 * - `checked` on input → DOM property.
 * - `false` → `removeAttribute` (boolean attribute pattern).
 * - Everything else → `el.setAttribute(key, String(value))`.
 *
 * Also sets `type="button"` on `<button>` elements that lack an explicit
 * `type` (prevents accidental form submission), and warns about
 * `<a target="_blank">` without `rel`.
 *
 * @param el    - The freshly-created DOM element.
 * @param props - The VNode's props object.
 */
export function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('$')) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      addSyntheticListener(el, key.slice(2).toLowerCase(), value as (e: SyntheticEvent) => void);
    } else if (key === 'className') {
      el.className = String(value);
    } else if (key === 'htmlFor') {
      el.setAttribute('for', String(value));
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      Object.assign(el.style, value);
    } else if (
      key === 'value' &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement)
    ) {
      // Use the DOM property so the live value is updated, not just the default
      (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = String(
        value ?? '',
      );
    } else if (key === 'checked' && el instanceof HTMLInputElement) {
      // Use the DOM property for checkboxes
      el.checked = Boolean(value);
    } else if (value === false) {
      el.removeAttribute(key);
    } else if (value != null) {
      el.setAttribute(key, String(value));
    }
  }

  // Handle $ref on initial mount
  setRef(props['$ref'], el);

  // Default <button> type to "button" to prevent accidental form submission.
  // The HTML default is "submit", which is almost never the intended behaviour.
  if (el instanceof HTMLButtonElement && !el.hasAttribute('type')) {
    el.setAttribute('type', 'button');
  }

  // Warn when <a target="_blank"> is used without any rel attribute.
  // Without rel the opened page can navigate the opener via window.opener (tab-napping).
  if (
    el instanceof HTMLAnchorElement &&
    el.getAttribute('target') === '_blank' &&
    !el.getAttribute('rel')
  ) {
    console.warn(
      'yielderact: <a target="_blank"> is missing rel="noopener". ' +
        'Add rel="noopener noreferrer" to prevent tab-napping attacks.',
    );
  }
}

/**
 * Diff and update props on an existing DOM element.
 *
 * Only touches the DOM for props that were added, removed, or changed
 * (compared via `Object.is`). This avoids unnecessary DOM writes.
 *
 * **Called by:** `reconcileOne` in `reconciler.ts` — when an HTML element
 * at the same position has the same tag but different props. Not called
 * when `liveOnlyMode` is true and the current batch is not `'live'`.
 *
 * Uses the same prop-handling rules as `applyProps` (event listeners,
 * className, style, value/checked DOM properties, etc.).
 *
 * @param el        - The existing DOM element to update.
 * @param prevProps - The props from the previous render (stored in `Slot.props`).
 * @param nextProps - The props from the new VNode.
 */
export function updateProps(
  el: HTMLElement,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  // 1. Remove props that no longer exist in nextProps
  for (const key in prevProps) {
    if (key.startsWith('$')) continue;
    if (key in nextProps) continue;
    if (key.startsWith('on') && typeof prevProps[key] === 'function') {
      removeSyntheticListener(el, key.slice(2).toLowerCase());
    } else if (key === 'className') {
      el.className = '';
    } else if (key === 'htmlFor') {
      el.removeAttribute('for');
    } else if (key === 'style') {
      el.removeAttribute('style');
    } else {
      el.removeAttribute(key);
    }
  }

  // 2. Add or update props that changed
  for (const key in nextProps) {
    if (key.startsWith('$')) continue;
    const next = nextProps[key];
    const prev = prevProps[key];
    if (Object.is(next, prev)) continue;

    if (key.startsWith('on') && typeof next === 'function') {
      if (typeof prev === 'function') removeSyntheticListener(el, key.slice(2).toLowerCase());
      addSyntheticListener(el, key.slice(2).toLowerCase(), next as (e: SyntheticEvent) => void);
    } else if (key === 'style' && typeof next === 'object' && next !== null) {
      // Clear removed style properties, then apply current ones
      if (typeof prev === 'object' && prev !== null) {
        for (const styleProp in prev as Record<string, unknown>) {
          if (!(styleProp in (next as Record<string, unknown>))) {
            el.style[styleProp as never] = '';
          }
        }
      }
      Object.assign(el.style, next);
    } else if (key === 'className') {
      el.className = String(next);
    } else if (key === 'htmlFor') {
      el.setAttribute('for', String(next));
    } else if (
      key === 'value' &&
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement)
    ) {
      (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = String(next ?? '');
    } else if (key === 'checked' && el instanceof HTMLInputElement) {
      el.checked = Boolean(next);
    } else if (next === false) {
      el.removeAttribute(key);
    } else if (next != null) {
      el.setAttribute(key, String(next));
    }
  }

  // 3. Handle $ref changes
  const prevRef = prevProps['$ref'];
  const nextRef = nextProps['$ref'];
  if (!Object.is(prevRef, nextRef)) {
    clearRef(prevRef);
    setRef(nextRef, el);
  }
}
