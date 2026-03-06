import { createElement } from '../jsx';
import { createContext, useContext } from '../context';
import { render } from '../render';
import { useState } from '../hooks';

// useContext is now a generator – components must call it with yield*

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('createContext / useContext', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('provides the default value when no Provider is present', () => {
    const Ctx = createContext('default');

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement('span', null, value);
    }

    render(createElement(Consumer as never, {}), container);
    expect(container.querySelector('span')!.textContent).toBe('default');
  });

  it('passes a value through Context.Provider to a consumer component', () => {
    const Ctx = createContext('default');

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement('span', null, value);
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: 'provided' },
        createElement(Consumer as never, {}),
      ),
      container,
    );
    expect(container.querySelector('span')!.textContent).toBe('provided');
  });

  it('nested Providers shadow the outer value', () => {
    const Ctx = createContext('outer');

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement('span', null, value);
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: 'outer' },
        createElement(
          'div',
          null,
          createElement(
            Ctx.Provider as never,
            { value: 'inner' },
            createElement(Consumer as never, {}),
          ),
        ),
      ),
      container,
    );
    expect(container.querySelector('span')!.textContent).toBe('inner');
  });

  it('consumer outside Provider still gets default value', () => {
    const Ctx = createContext(42);

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement('span', null, String(val));
    }

    render(
      createElement(
        'div',
        null,
        createElement(
          Ctx.Provider as never,
          { value: 99 },
          createElement('span', { id: 'inside' }, 'ignored'),
        ),
        createElement(Consumer as never, {}),
      ),
      container,
    );
    const spans = container.querySelectorAll('span');
    const consumerSpan = Array.from(spans).find((s) => s.textContent === '42');
    expect(consumerSpan).toBeTruthy();
  });

  it('generator component reads context on every re-render', () => {
    const Ctx = createContext(0);
    let setTheme: ((v: number) => void) | null = null;

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement('span', null, String(val));
    }

    function* Parent() {
      const [theme, st] = yield* useState(7);
      setTheme = st;
      return createElement(
        Ctx.Provider as never,
        { value: theme },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('span')!.textContent).toBe('7');

    setTheme!(99);
    expect(container.querySelector('span')!.textContent).toBe('99');
  });

  describe('useContext with selector', () => {
    it('selector-only: returns full context value when selector present', () => {
      const Ctx = createContext({ a: 1, b: 2 });

      function* Consumer() {
        const val = yield* useContext(Ctx, (c) => [c.a]);
        return createElement('span', null, `${val.a}:${val.b}`);
      }

      render(
        createElement(
          Ctx.Provider as never,
          { value: { a: 1, b: 2 } },
          createElement(Consumer as never, {}),
        ),
        container,
      );
      expect(container.querySelector('span')!.textContent).toBe('1:2');
    });

    it('selector-only: suppresses rerender when selected deps are stable', () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: ((v: { a: number; b: number }) => void) | null = null;
      let renderCount = 0;

      function* Consumer() {
        yield* useContext(Ctx, (c) => [c.a]);
        renderCount++;
        return createElement('span', null, String(renderCount));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change only `b` — selector selects `a`, so Consumer should NOT rerender.
      setVal!({ a: 1, b: 99 });
      expect(renderCount).toBe(1);
      expect(container.querySelector('span')!.textContent).toBe('1');
    });

    it('selector-only: rerenders when selected dep changes', () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: ((v: { a: number; b: number }) => void) | null = null;
      let renderCount = 0;

      function* Consumer() {
        const val = yield* useContext(Ctx, (c) => [c.a]);
        renderCount++;
        return createElement('span', null, String(val.a));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change `a` — selector selects `a`, so Consumer SHOULD rerender.
      setVal!({ a: 99, b: 1 });
      expect(renderCount).toBe(2);
      expect(container.querySelector('span')!.textContent).toBe('99');
    });

    it('selector + transform: returns transformed value', () => {
      const Ctx = createContext({ name: 'Alice', age: 30 });

      function* Consumer() {
        const name = yield* useContext(
          Ctx,
          (c) => [c.name] as [string],
          (n) => n.toUpperCase(),
        );
        return createElement('span', null, name);
      }

      render(
        createElement(
          Ctx.Provider as never,
          { value: { name: 'Alice', age: 30 } },
          createElement(Consumer as never, {}),
        ),
        container,
      );
      expect(container.querySelector('span')!.textContent).toBe('ALICE');
    });

    it('selector + transform: suppresses rerender when deps stable', () => {
      const Ctx = createContext({ name: 'Alice', count: 0 });
      let setVal: ((v: { name: string; count: number }) => void) | null = null;
      let renderCount = 0;

      function* Consumer() {
        yield* useContext(
          Ctx,
          (c) => [c.name] as [string],
          (n) => n.toUpperCase(),
        );
        renderCount++;
        return createElement('span', null, String(renderCount));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ name: 'Alice', count: 0 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change only `count` — selector tracks `name`, so no rerender.
      setVal!({ name: 'Alice', count: 99 });
      expect(renderCount).toBe(1);
    });

    it('selector: hook state (useState) is preserved across suppressed rerenders', () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: ((v: { a: number; b: number }) => void) | null = null;
      let setLocal: ((v: number) => void) | null = null;

      function* Consumer() {
        yield* useContext(Ctx, (c) => [c.a]);
        const [local, sl] = yield* useState(42);
        setLocal = sl;
        return createElement('span', null, String(local));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      // Update local state in Consumer.
      setLocal!(100);
      expect(container.querySelector('span')!.textContent).toBe('100');

      // Trigger a context change that should be suppressed (b changes, a stable).
      setVal!({ a: 1, b: 99 });
      // Consumer should NOT have remounted — local state preserved.
      expect(container.querySelector('span')!.textContent).toBe('100');
    });

    it('no-selector consumer falls through to remount when Provider value changes', () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: ((v: { a: number; b: number }) => void) | null = null;
      let renderCount = 0;

      function* Consumer() {
        const val = yield* useContext(Ctx);
        renderCount++;
        return createElement('span', null, `${val.a}:${val.b}`);
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change only `b` — Consumer has no selector so it always rerenders.
      setVal!({ a: 1, b: 99 });
      expect(renderCount).toBe(2);
      expect(container.querySelector('span')!.textContent).toBe('1:99');
    });
  });
});
