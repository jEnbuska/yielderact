import { type SyntheticEvent } from '../events';
import { addSyntheticListener, removeSyntheticListener } from './events';

/**
 * Apply a VNode's props to a real DOM element.
 *
 * - `onXxx` props become synthetic-event listeners
 * - `className` maps to `element.className`
 * - `htmlFor` maps to the `for` HTML attribute
 * - `style` (object) is merged into `element.style`
 * - Everything else becomes an HTML attribute
 */
export function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === '$shown' || key === '$patch') continue;
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
 * Only touches the DOM when a prop was added, removed, or changed.
 */
export function updateProps(
  el: HTMLElement,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  // 1. Remove props that no longer exist in nextProps
  for (const key in prevProps) {
    if (key === 'children' || key === '$shown' || key === '$patch') continue;
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
    if (key === 'children' || key === '$shown' || key === '$patch') continue;
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
}
