import { createElement } from '../jsx';
import { render } from '../render';
import { useRef, useId, useMemo, useState } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('useState', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('accepts a lazy initializer function called only once', () => {
    const init = jest.fn(() => 42);
    let capturedValue: number | null = null;
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(init);
      capturedValue = v;
      setValue = sv;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(init).toHaveBeenCalledTimes(1);
    expect(capturedValue).toBe(42);

    // Re-render should not call the initializer again
    setValue!(99);
    expect(init).toHaveBeenCalledTimes(1);
    expect(capturedValue).toBe(99);
  });

  it('accepts a functional updater that receives the previous state', () => {
    const values: number[] = [];
    let setValue: ((v: number | ((prev: number) => number)) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(0);
      values.push(v);
      setValue = sv;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(values).toEqual([0]);

    setValue!(prev => prev + 5);
    expect(values).toEqual([0, 5]);

    setValue!(prev => prev * 2);
    expect(values).toEqual([0, 5, 10]);
  });
});

describe('useRef', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns an object with the initial value in .current', () => {
    let capturedRef: { current: number } | null = null;

    function* Comp() {
      const ref = yield* useRef(42);
      capturedRef = ref;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
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

    render(createElement(Comp as never, {}), container);
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

    render(createElement(Comp as never, {}), container);
    expect(renderCount).toBe(1);

    capturedRef!.current = 99;
    expect(renderCount).toBe(1);
    expect(capturedRef!.current).toBe(99);
  });
});

describe('useId', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns a non-empty string', () => {
    let capturedId: string | null = null;

    function* Comp() {
      capturedId = yield* useId();
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(typeof capturedId).toBe('string');
    expect(capturedId!.length).toBeGreaterThan(0);
  });

  it('returns the same id across re-renders', () => {
    const ids: string[] = [];
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      const id = yield* useId();
      ids.push(id);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    setValue!(1);

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('returns distinct ids for different hook call sites', () => {
    let id1: string | null = null;
    let id2: string | null = null;

    function* Comp() {
      id1 = yield* useId();
      id2 = yield* useId();
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(id1).not.toBe(id2);
  });
});

describe('useMemo', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('computes the initial value by calling fn with deps', () => {
    const factory = jest.fn((a: number, b: number) => a + b);
    let capturedValue: number | null = null;

    function* Comp() {
      capturedValue = yield* useMemo(factory, [2, 3]);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(2, 3);
    expect(capturedValue).toBe(5);
  });

  it('does not recompute when deps are the same', () => {
    const factory = jest.fn((a: number) => a * 2);
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(10);
      setValue = sv;
      yield* useMemo(factory, [5]);
      return createElement('div', null, String(v));
    }

    render(createElement(Comp as never, {}), container);
    setValue!(20); // trigger re-render, same dep [5]

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('recomputes when deps change', () => {
    const factory = jest.fn((a: number) => a * 2);
    let setValue: ((v: number) => void) | null = null;
    let capturedValue: number | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(1);
      setValue = sv;
      capturedValue = yield* useMemo(factory, [v]);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(capturedValue).toBe(2);
    expect(factory).toHaveBeenCalledTimes(1);

    setValue!(3);
    expect(capturedValue).toBe(6);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenLastCalledWith(3);
  });

  it('works with empty deps (zero-arg factory)', () => {
    const factory = jest.fn(() => 42);
    let setValue: ((v: number) => void) | null = null;
    let capturedValue: number | null = null;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      capturedValue = yield* useMemo(factory, []);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(capturedValue).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);

    setValue!(1); // re-render, empty deps never change
    expect(capturedValue).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
