/**
 * Shared test utilities for jsdom-based unit tests.
 */

/**
 * Sets up a fresh DOM container before each test and removes it after.
 * Returns a ref object whose `.current` property always holds the current container.
 *
 * Usage:
 *   const container = setupContainer();
 *   render(vnode, container.current);
 */
export function setupContainer(): { current: HTMLElement } {
  const ref = { current: null as unknown as HTMLElement };

  beforeEach(() => {
    ref.current = document.createElement('div');
    document.body.appendChild(ref.current);
  });

  afterEach(() => {
    document.body.removeChild(ref.current);
  });

  return ref;
}
