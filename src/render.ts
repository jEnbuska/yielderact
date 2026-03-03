import { Fragment, VNode, Child, GeneratorComponentFn, PlainComponentFn, AnyComponentFn } from './jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when `fn` is a generator function (i.e. uses `function*`). */
function isGeneratorFn(fn: AnyComponentFn): fn is GeneratorComponentFn {
  return fn.constructor.name === 'GeneratorFunction';
}

/** Remove all child nodes from a DOM element. */
function clearChildren(node: Node): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

// ---------------------------------------------------------------------------
// Prop application
// ---------------------------------------------------------------------------

/**
 * Apply a VNode's props to a real DOM element.
 *
 * - `onXxx` props become event listeners (`addEventListener`)
 * - `className` maps to `element.className`
 * - `style` (object) is merged into `element.style`
 * - Everything else becomes an HTML attribute
 */
function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') continue; // children are handled separately
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'className') {
      el.className = String(value);
    } else if (key === 'style' && typeof value === 'object' && value !== null) {
      Object.assign(el.style, value);
    } else if (value != null) {
      el.setAttribute(key, String(value));
    }
  }
}

// ---------------------------------------------------------------------------
// Virtual DOM → real DOM
// ---------------------------------------------------------------------------

/**
 * Build a real DOM node from a virtual DOM node (or primitive child value).
 *
 * This is the core of the renderer. It handles:
 *  1. Text / number / primitive children → TextNode
 *  2. `null` / `undefined` / `false` → empty TextNode (renders nothing)
 *  3. `Fragment` → DocumentFragment containing children
 *  4. Generator-function components → mounted via `mountGeneratorComponent`
 *  5. Plain-function components → called once and their output is built
 *  6. HTML tag strings → real HTMLElement with props and children
 */
export function buildNode(child: Child): Node {
  // Primitives and empty values
  if (child == null || child === false) {
    return document.createTextNode('');
  }
  if (typeof child === 'string' || typeof child === 'number') {
    return document.createTextNode(String(child));
  }

  const vnode = child as VNode;

  // Fragment – transparent wrapper
  if (vnode.type === Fragment) {
    const frag = document.createDocumentFragment();
    for (const c of vnode.children) {
      frag.appendChild(buildNode(c));
    }
    return frag;
  }

  // Component (generator function or plain function)
  if (typeof vnode.type === 'function') {
    const fn = vnode.type as AnyComponentFn;
    const allProps =
      vnode.children.length > 0
        ? { ...vnode.props, children: vnode.children }
        : vnode.props;

    return isGeneratorFn(fn)
      ? mountGeneratorComponent(fn, allProps)
      : mountPlainComponent(fn as PlainComponentFn, allProps);
  }

  // HTML element
  const el = document.createElement(vnode.type as string);
  applyProps(el, vnode.props);
  for (const c of vnode.children) {
    el.appendChild(buildNode(c));
  }
  return el;
}

// ---------------------------------------------------------------------------
// Component mounting
// ---------------------------------------------------------------------------

/**
 * Mount a generator-function component.
 *
 * The component lives in a `<span style="display:contents">` host node.
 * `display:contents` makes the span transparent to layout, so the component
 * can be anywhere in the tree without affecting the visual result.
 *
 * Lifecycle:
 *  1. The generator is started with `gen.next()` → runs until the first `yield`
 *  2. The yielded VNode is rendered into the host span
 *  3. When `rerender()` is called (e.g. from an event handler), the generator
 *     is advanced with another `gen.next()`, and the host's content is replaced
 *     with the newly yielded VNode
 */
function mountGeneratorComponent(
  fn: GeneratorComponentFn,
  props: Record<string, unknown>
): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';

  function rerender(): void {
    const { value: vnode, done } = gen.next();
    if (!done) {
      clearChildren(host);
      if (vnode != null) host.appendChild(buildNode(vnode));
    }
  }

  const gen = fn(props, rerender);
  const { value: initialVNode } = gen.next();
  if (initialVNode != null) host.appendChild(buildNode(initialVNode));

  return host;
}

/**
 * Mount a plain (non-generator) function component.
 *
 * The function is called once with its props, and the returned VNode is
 * rendered into a host span.  Plain components have no built-in state;
 * they are re-rendered by their parent.
 */
function mountPlainComponent(
  fn: PlainComponentFn,
  props: Record<string, unknown>
): Node {
  const host = document.createElement('span');
  host.style.display = 'contents';

  const vnode = fn(props);
  if (vnode != null) host.appendChild(buildNode(vnode));

  return host;
}

// ---------------------------------------------------------------------------
// Public render function
// ---------------------------------------------------------------------------

/**
 * Render a VNode into a real DOM container.
 *
 * Call this once to mount your application:
 *
 * @example
 * render(<App />, document.getElementById('root')!);
 */
export function render(vnode: VNode, container: Element): void {
  container.appendChild(buildNode(vnode));
}
