import { createElement } from '../jsx';
import { render } from '../render';
import { $state, $memo } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('$memo', () => {
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
      capturedValue = yield* $memo(factory, [2, 3]);
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
      const [v, sv] = yield* $state(10);
      setValue = sv;
      yield* $memo(factory, [5]);
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
      const [v, sv] = yield* $state(1);
      setValue = sv;
      capturedValue = yield* $memo(factory, [v]);
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
      const [, sv] = yield* $state(0);
      setValue = sv;
      capturedValue = yield* $memo(factory, []);
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
