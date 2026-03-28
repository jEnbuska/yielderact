/**
 * initial-mount/ — Code paths used only during initial root mount.
 *
 * `buildNode` constructs the DOM tree from VNodes.
 * `mountComponent` creates component instances and runs their first render.
 *
 * After initial mount, all updates go through `component/rerender.ts`
 * and the scheduler.
 */

export { buildNode } from "./build-node";
export { mountComponent } from "./mount-component";
