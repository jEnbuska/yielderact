import { createElement } from '../jsx';
import { render } from '../render';
import { $state, $id } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('$id', () => {
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
      capturedId = yield* $id();
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
      const [, sv] = yield* $state(0);
      setValue = sv;
      const id = yield* $id();
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
      id1 = yield* $id();
      id2 = yield* $id();
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(id1).not.toBe(id2);
  });
});
