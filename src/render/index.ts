import { type VNode } from '../jsx';
import { buildNode } from './mount';

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
