import { createElement } from '../../jsx';
import { render } from '../../render';
import { useState, useRef } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('useRef', () => {
  const container = setupContainer();

  it('returns an object with the initial value in .current', () => {
    let capturedRef: { current: number } | null = null;

    function* Comp() {
      const ref = yield* useRef(42);
      capturedRef = ref;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container.current);
    expect(capturedRef).not.toBeNull();
    expect(capturedRef!.current).toBe(42);
  });

  it('persists the same object across re-renders', () => {
    const refInstances: object[] = [];
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      const ref = yield* useRef(0);
      refInstances.push(ref);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container.current);
    setValue!(1);

    expect(refInstances).toHaveLength(2);
    expect(refInstances[0]).toBe(refInstances[1]);
  });

  it('mutations to .current do not trigger a re-render', () => {
    let renderCount = 0;
    let capturedRef: { current: number } | null = null;

    function* Comp() {
      renderCount++;
      const ref = yield* useRef(0);
      capturedRef = ref;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container.current);
    expect(renderCount).toBe(1);

    capturedRef!.current = 99;
    expect(renderCount).toBe(1);
    expect(capturedRef!.current).toBe(99);
  });
});
