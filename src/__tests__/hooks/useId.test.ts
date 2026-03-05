import { createElement } from '../../jsx';
import { render } from '../../render';
import { useState, useId } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('useId', () => {
  const container = setupContainer();

  it('returns a non-empty string', () => {
    let capturedId: string | null = null;

    function* Comp() {
      capturedId = yield* useId();
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container.current);
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

    render(createElement(Comp as never, {}), container.current);
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

    render(createElement(Comp as never, {}), container.current);
    expect(id1).not.toBe(id2);
  });
});
