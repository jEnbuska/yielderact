import { createElement } from '../../jsx';
import { render } from '../../render';
import { useState } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('shown prop', () => {
  const container = setupContainer();

  it('renders an HTML element when shown is true', () => {
    render(createElement('div', { $shown: true }, 'visible'), container.current);
    expect(container.current.querySelector('div')).not.toBeNull();
    expect(container.current.querySelector('div')!.textContent).toBe('visible');
  });

  it('does not render an HTML element when shown is false', () => {
    render(createElement('div', { $shown: false }, 'hidden'), container.current);
    expect(container.current.querySelector('div')).toBeNull();
  });

  it('renders an HTML element when shown is omitted (defaults to shown)', () => {
    render(createElement('div', null, 'visible'), container.current);
    expect(container.current.querySelector('div')).not.toBeNull();
  });

  it('does not set shown as a DOM attribute', () => {
    render(createElement('div', { $shown: true }, 'visible'), container.current);
    const el = container.current.querySelector('div')!;
    expect(el.hasAttribute('$shown')).toBe(false);
  });

  it('renders a plain function component when shown is true', () => {
    function Greeting() {
      return createElement('p', null, 'hello');
    }
    render(
      createElement('div', null, createElement(Greeting as never, { $shown: true })),
      container.current,
    );
    expect(container.current.querySelector('p')).not.toBeNull();
  });

  it('does not render a plain function component when shown is false', () => {
    function Greeting() {
      return createElement('p', null, 'hello');
    }
    render(
      createElement('div', null, createElement(Greeting as never, { $shown: false })),
      container.current,
    );
    expect(container.current.querySelector('p')).toBeNull();
  });

  it('renders a generator component when shown is true', () => {
    function* Counter() {
      return createElement('p', null, 'counter');
    }
    render(
      createElement('div', null, createElement(Counter as never, { $shown: true })),
      container.current,
    );
    expect(container.current.querySelector('p')).not.toBeNull();
  });

  it('does not render a generator component when shown is false', () => {
    function* Counter() {
      return createElement('p', null, 'counter');
    }
    render(
      createElement('div', null, createElement(Counter as never, { $shown: false })),
      container.current,
    );
    expect(container.current.querySelector('p')).toBeNull();
  });

  it('unmounts an HTML element when shown changes from true to false', () => {
    let setShown: ((v: boolean) => void) | null = null;

    function* Wrapper() {
      const [$shown, setS] = yield* useState(true);
      setShown = setS;
      return createElement('div', { $shown }, 'content');
    }

    render(createElement(Wrapper as never, {}), container.current);
    expect(container.current.querySelector('div')).not.toBeNull();

    setShown!(false);
    expect(container.current.querySelector('div')).toBeNull();
  });

  it('mounts an HTML element when shown changes from false to true', () => {
    let setShown: ((v: boolean) => void) | null = null;

    function* Wrapper() {
      const [$shown, setS] = yield* useState(false);
      setShown = setS;
      return createElement('div', { $shown }, 'content');
    }

    render(createElement(Wrapper as never, {}), container.current);
    expect(container.current.querySelector('div')).toBeNull();

    setShown!(true);
    expect(container.current.querySelector('div')).not.toBeNull();
    expect(container.current.querySelector('div')!.textContent).toBe('content');
  });

  it('unmounts a component when shown changes from true to false', () => {
    let setShown: ((v: boolean) => void) | null = null;

    function* Inner() {
      return createElement('p', null, 'inner');
    }

    function* Wrapper() {
      const [$shown, setS] = yield* useState(true);
      setShown = setS;
      return createElement(Inner as never, { $shown });
    }

    render(createElement(Wrapper as never, {}), container.current);
    expect(container.current.querySelector('p')).not.toBeNull();

    setShown!(false);
    expect(container.current.querySelector('p')).toBeNull();
  });

  it('mounts a component when shown changes from false to true', () => {
    let setShown: ((v: boolean) => void) | null = null;

    function* Inner() {
      return createElement('p', null, 'inner');
    }

    function* Wrapper() {
      const [$shown, setS] = yield* useState(false);
      setShown = setS;
      return createElement(Inner as never, { $shown });
    }

    render(createElement(Wrapper as never, {}), container.current);
    expect(container.current.querySelector('p')).toBeNull();

    setShown!(true);
    expect(container.current.querySelector('p')).not.toBeNull();
    expect(container.current.querySelector('p')!.textContent).toBe('inner');
  });
});
