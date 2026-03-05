import { createElement } from '../../jsx';
import { createContext, useContext } from '../../context';
import { render } from '../../render';
import { useState } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('createContext / useContext', () => {
  const container = setupContainer();

  it('provides the default value when no Provider is present', () => {
    const Ctx = createContext('default');

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement('span', null, value);
    }

    render(createElement(Consumer as never, {}), container.current);
    expect(container.current.querySelector('span')!.textContent).toBe('default');
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
      container.current,
    );
    expect(container.current.querySelector('span')!.textContent).toBe('provided');
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
      container.current,
    );
    expect(container.current.querySelector('span')!.textContent).toBe('inner');
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
      container.current,
    );
    const spans = container.current.querySelectorAll('span');
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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('span')!.textContent).toBe('7');

    setTheme!(99);
    expect(container.current.querySelector('span')!.textContent).toBe('99');
  });
});
