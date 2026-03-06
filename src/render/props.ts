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
 * Removes stale event listeners/attributes and applies new ones.
 */
export function updateProps(
  el: HTMLElement,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  // Always remove old event listeners (they may be replaced by new functions)
  for (const key in prevProps) {
    if (key === 'children' || key === '$shown' || key === '$patch') continue;
    if (key === 'style') {
      // Remove style properties that are no longer present in nextProps.style
      const prevStyle = prevProps[key] as Record<string, string> | null | undefined;
      const nextStyle = nextProps[key] as Record<string, string> | null | undefined;
      if (prevStyle && typeof prevStyle === 'object') {
        for (const styleProp in prevStyle) {
          if (!nextStyle || !(styleProp in nextStyle)) {
            el.style[styleProp as never] = '';
          }
        }
      }
    } else if (key.startsWith('on') && typeof prevProps[key] === 'function') {
      removeSyntheticListener(el, key.slice(2).toLowerCase());
    } else if (!(key in nextProps)) {
      if (key === 'className') {
        el.className = '';
      } else if (key === 'htmlFor') {
        el.removeAttribute('for');
      } else {
        el.removeAttribute(key);
      }
    }
  }
  // Apply all current props (re-adds event listeners + sets attrs)
  applyProps(el, nextProps);
}
