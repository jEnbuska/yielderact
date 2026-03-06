import { createElement } from '../jsx';
import { createRoot } from '../render';
import { useState } from '../hooks';
import { renderState } from '../render/state';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('createRoot', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a plain component into the container', () => {
    function Greeting({ name }: { name: string }) {
      return createElement('h1', null, `Hello, ${name}!`);
    }
    const root = createRoot(container);
    root.render(createElement(Greeting as never, { name: 'World' }));
    expect(container.querySelector('h1')!.textContent).toBe('Hello, World!');
  });

  it('renders a generator component into the container', () => {
    function* Counter() {
      const [count] = yield* useState(0);
      return createElement('span', null, String(count));
    }
    const root = createRoot(container);
    root.render(createElement(Counter as never, {}));
    expect(container.textContent).toBe('0');
  });

  it('sets $patch context to "default" for the rendered tree', () => {
    let capturedBatch: string | undefined;

    function* Comp() {
      capturedBatch = renderState.currentBatchBehavior;
      return createElement('div', null);
    }

    const root = createRoot(container);
    root.render(createElement(Comp as never, {}));
    expect(capturedBatch).toBe('default');
  });

  it('restores previous $patch context after render', () => {
    const origBatch = renderState.currentBatchBehavior;
    const root = createRoot(container);
    root.render(createElement('div', null));
    expect(renderState.currentBatchBehavior).toBe(origBatch);
  });
});
