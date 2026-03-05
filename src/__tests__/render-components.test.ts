import { createElement } from '../jsx';
import { render } from '../render';
import { useState } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('render – plain function components', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('calls the function and renders the returned JSX', () => {
    function Greeting({ name }: { name: string }) {
      return createElement('h1', null, `Hello, ${name}!`);
    }
    render(createElement(Greeting as never, { name: 'World' }), container);
    expect(container.querySelector('h1')!.textContent).toBe('Hello, World!');
  });

  it('renders an empty host when the component returns null', () => {
    function Empty() {
      return null;
    }
    render(createElement(Empty as never, {}), container);
    const host = container.firstChild as HTMLElement;
    expect(host.childElementCount).toBe(0);
  });

  it('renders an empty host when the component returns undefined', () => {
    function Empty() {
      return undefined;
    }
    render(createElement(Empty as never, {}), container);
    const host = container.firstChild as HTMLElement;
    expect(host.childElementCount).toBe(0);
  });
});

describe('render – generator components', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a generator component that returns JSX', () => {
    function* Greeting({ name }: { name: string }) {
      return createElement('h2', null, `Hi, ${name}!`);
    }
    render(createElement(Greeting as never, { name: 'Alice' }), container);
    expect(container.querySelector('h2')!.textContent).toBe('Hi, Alice!');
  });

  it('rerenders via useState setter', () => {
    let setCount: ((v: number) => void) | null = null;

    function* Counter() {
      const [count, sc] = yield* useState(0);
      setCount = sc;
      return createElement('button', {}, String(count));
    }

    render(createElement(Counter as never, {}), container);
    expect(container.querySelector('button')!.textContent).toBe('0');

    setCount!(1);
    expect(container.querySelector('button')!.textContent).toBe('1');

    setCount!(5);
    expect(container.querySelector('button')!.textContent).toBe('5');
  });

  it('rerenders when rerender() is called directly from an event handler', () => {
    function* Counter(_props: Record<string, unknown>, rerender: () => void) {
      const [count, setCount] = yield* useState(0);
      return createElement(
        'button',
        {
          onClick: () => {
            setCount(count + 1);
          },
        },
        String(count),
      );
    }

    render(createElement(Counter as never, {}), container);

    expect(container.querySelector('button')!.textContent).toBe('0');
    container.querySelector('button')!.click();
    expect(container.querySelector('button')!.textContent).toBe('1');
    container.querySelector('button')!.click();
    expect(container.querySelector('button')!.textContent).toBe('2');
  });

  it('renders generator components nested inside HTML elements', () => {
    function* Label({ text }: { text: string }) {
      return createElement('span', null, text);
    }

    render(
      createElement(
        'div',
        { className: 'wrapper' },
        createElement(Label as never, { text: 'nested' }),
      ),
      container,
    );

    expect(container.querySelector('span')!.textContent).toBe('nested');
  });

  it('passes children in props', () => {
    function* Wrapper({ children }: { children: unknown }) {
      return createElement('section', null, ...(children as never[]));
    }

    render(
      createElement(Wrapper as never, {}, createElement('p', null, 'child content')),
      container,
    );

    expect(container.querySelector('p')!.textContent).toBe('child content');
  });
});

describe('render – generator components with useState', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('useState persists value across re-renders', () => {
    let setLabel: ((v: string) => void) | null = null;

    function* Label() {
      const [text, st] = yield* useState('initial');
      setLabel = st;
      return createElement('p', null, text);
    }

    render(createElement(Label as never, {}), container);
    expect(container.querySelector('p')!.textContent).toBe('initial');

    setLabel!('updated');
    expect(container.querySelector('p')!.textContent).toBe('updated');

    setLabel!('again');
    expect(container.querySelector('p')!.textContent).toBe('again');
  });

  it('multiple useState calls maintain independent state', () => {
    let setA: ((v: string) => void) | null = null;
    let setB: ((v: number) => void) | null = null;

    function* Multi() {
      const [a, sa] = yield* useState('hello');
      const [b, sb] = yield* useState(0);
      setA = sa;
      setB = sb;
      return createElement('p', null, `${a}-${b}`);
    }

    render(createElement(Multi as never, {}), container);
    expect(container.querySelector('p')!.textContent).toBe('hello-0');

    setA!('world');
    expect(container.querySelector('p')!.textContent).toBe('world-0');

    setB!(42);
    expect(container.querySelector('p')!.textContent).toBe('world-42');
  });
});
