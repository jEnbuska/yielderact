import { type VNode } from '../jsx';
import { buildNode } from './mount';
import { renderState } from './state';

export { startUIPatch, commitUIPatch } from './patch';
export { buildNode } from './mount';

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

/**
 * A root created by `createRoot`.  Holds a reference to the container element
 * and exposes a `render` method that mounts the application with `$patch`
 * defaulting to `"default"` for the entire tree.
 */
export interface Root {
  render(vnode: VNode): void;
}

/**
 * Create a root for rendering into the given DOM container.
 *
 * The root sets `$patch="default"` as the starting context for the whole
 * component tree, so every component can always rely on `$patch` being
 * defined.
 *
 * @example
 * const root = createRoot(document.getElementById('root')!);
 * root.render(<App />);
 */
export function createRoot(container: Element): Root {
  return {
    render(vnode: VNode): void {
      const prevBatch = renderState.currentBatchBehavior;
      renderState.currentBatchBehavior = 'default';
      try {
        container.appendChild(buildNode(vnode));
      } finally {
        renderState.currentBatchBehavior = prevBatch;
      }
    },
  };
}
