import { createElement, Fragment } from '../jsx';
import { render, buildNode } from '../render';
import { useState, usePromise } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('render – HTML elements', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders a plain element', () => {
    render(createElement('div', null), container);
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it('renders a text child', () => {
    render(createElement('p', null, 'Hello World'), container);
    expect(container.querySelector('p')!.textContent).toBe('Hello World');
  });

  it('renders nested elements', () => {
    render(
      createElement('div', null, createElement('span', null, 'inner')),
      container
    );
    expect(container.querySelector('span')!.textContent).toBe('inner');
  });

  it('applies className', () => {
    render(createElement('div', { className: 'foo bar' }), container);
    expect((container.firstChild as HTMLElement).className).toBe('foo bar');
  });

  it('applies arbitrary attributes', () => {
    render(createElement('input', { type: 'text', placeholder: 'name' }), container);
    const input = container.querySelector('input')!;
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('placeholder')).toBe('name');
  });

  it('applies event listeners and wraps in SyntheticEvent', () => {
    const onClick = jest.fn();
    render(createElement('button', { onClick }, 'click me'), container);
    container.querySelector('button')!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    // The handler receives a SyntheticEvent, not the raw native event
    const syntheticEvent = onClick.mock.calls[0][0];
    expect(syntheticEvent).toHaveProperty('nativeEvent');
    expect(syntheticEvent).toHaveProperty('type', 'click');
    expect(typeof syntheticEvent.preventDefault).toBe('function');
    expect(typeof syntheticEvent.stopPropagation).toBe('function');
  });

  it('applies inline styles', () => {
    render(createElement('div', { style: { color: 'red', fontSize: '14px' } }), container);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('red');
    expect(el.style.fontSize).toBe('14px');
  });

  it('renders a Fragment with multiple children', () => {
    render(
      createElement('ul', null,
        createElement(Fragment, null,
          createElement('li', null, 'one'),
          createElement('li', null, 'two')
        )
      ),
      container
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('one');
    expect(items[1].textContent).toBe('two');
  });

  it('skips null and undefined children', () => {
    render(createElement('div', null, null, undefined, 'visible'), container);
    expect(container.querySelector('div')!.textContent).toBe('visible');
  });
  it('sets input value as DOM property (not just attribute)', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Controlled() {
      const [val, sv] = yield* useState('initial');
      setValue = sv;
      return createElement('input', { type: 'text', value: val });
    }

    render(createElement(Controlled as never, {}), container);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('initial');

    setValue!('updated');
    expect(input.value).toBe('updated');

    setValue!('');
    expect(input.value).toBe('');
  });

  it('sets checkbox checked as DOM property', () => {
    let setChecked: ((v: boolean) => void) | null = null;

    function* CheckBox() {
      const [checked, sc] = yield* useState(false);
      setChecked = sc;
      return createElement('input', { type: 'checkbox', checked });
    }

    render(createElement(CheckBox as never, {}), container);
    const cb = container.querySelector('input') as HTMLInputElement;
    expect(cb.checked).toBe(false);

    setChecked!(true);
    expect(cb.checked).toBe(true);

    setChecked!(false);
    expect(cb.checked).toBe(false);
  });
});

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
    function Empty() { return null; }
    render(createElement(Empty as never, {}), container);
    const host = container.firstChild as HTMLElement;
    expect(host.childElementCount).toBe(0);
  });

  it('renders an empty host when the component returns undefined', () => {
    function Empty() { return undefined; }
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
        { onClick: () => { setCount(count + 1); } },
        String(count)
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
      createElement('div', { className: 'wrapper' },
        createElement(Label as never, { text: 'nested' })
      ),
      container
    );

    expect(container.querySelector('span')!.textContent).toBe('nested');
  });

  it('passes children in props', () => {
    function* Wrapper({ children }: { children: unknown }) {
      return createElement('section', null, ...(children as never[]));
    }

    render(
      createElement(Wrapper as never, {},
        createElement('p', null, 'child content')
      ),
      container
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

describe('render – generator components with usePromise', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('shows loading state while promise is pending', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>(res => { resolvePromise = res; });

    function* DataComp() {
      const data = yield* usePromise({
        fn: () => promise,
        loading: createElement('span', { id: 'loading' }, 'Loading…'),
        error: createElement('span', { id: 'error' }, 'Error'),
      });
      return createElement('span', { id: 'data' }, data);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector('#loading')).not.toBeNull();
    expect(container.querySelector('#data')).toBeNull();

    resolvePromise('Hello World');
    await promise;

    expect(container.querySelector('#loading')).toBeNull();
    expect(container.querySelector('#data')).not.toBeNull();
    expect(container.querySelector('#data')!.textContent).toBe('Hello World');
  });

  it('shows error state when promise rejects', async () => {
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<string>((_res, rej) => { rejectPromise = rej; });

    function* DataComp() {
      const data = yield* usePromise({
        fn: () => promise,
        loading: createElement('span', { id: 'loading' }, 'Loading…'),
        error: createElement('span', { id: 'error' }, 'Error'),
      });
      return createElement('span', { id: 'data' }, data);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector('#loading')).not.toBeNull();

    rejectPromise(new Error('network error'));
    await promise.catch(() => {}); // wait for rejection to propagate

    expect(container.querySelector('#error')).not.toBeNull();
    expect(container.querySelector('#data')).toBeNull();
  });

  it('usePromise can coexist with useState in the same component', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>(res => { resolvePromise = res; });
    let setLabel: ((v: string) => void) | null = null;

    function* DataComp() {
      const [label, sl] = yield* useState('prefix');
      setLabel = sl;
      const data = yield* usePromise({
        fn: () => promise,
        loading: createElement('span', { id: 'loading' }, 'Loading…'),
        error: createElement('span', null, 'Error'),
      });
      return createElement('p', { id: 'result' }, `${label}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector('#loading')).not.toBeNull();

    resolvePromise('world');
    await promise;

    expect(container.querySelector('#result')!.textContent).toBe('prefix:world');

    setLabel!('updated');
    expect(container.querySelector('#result')!.textContent).toBe('updated:world');
  });

  it('useState change while promise is pending triggers fresh run and shows correct state after resolve', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>(res => { resolvePromise = res; });
    let setLabel: ((v: string) => void) | null = null;

    function* DataComp() {
      const [label, sl] = yield* useState('prefix');
      setLabel = sl;
      const data = yield* usePromise({
        fn: () => promise,
        loading: createElement('span', { id: 'loading' }, 'Loading…'),
        error: createElement('span', null, 'Error'),
      });
      return createElement('p', { id: 'result' }, `${label}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector('#loading')).not.toBeNull();

    // Change state WHILE the promise is still pending
    setLabel!('updated');
    // Still loading, but label should be reflected after resolve
    expect(container.querySelector('#loading')).not.toBeNull();

    resolvePromise('world');
    await promise;

    // The fresh run after setLabel captured 'updated'; resume uses that generator
    expect(container.querySelector('#result')!.textContent).toBe('updated:world');
  });

  it('usePromise re-runs when deps change', async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>(res => { resolveFirst = res; });
    const secondPromise = new Promise<string>(res => { resolveSecond = res; });

    let setId: ((v: number) => void) | null = null;
    let fetchCount = 0;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const data = yield* usePromise({
        fn: () => { fetchCount++; return id === 1 ? firstPromise : secondPromise; },
        loading: createElement('span', { id: 'loading' }, 'Loading…'),
        error: createElement('span', null, 'Error'),
        deps: [id],
      });
      return createElement('p', { id: 'result' }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(fetchCount).toBe(1);
    expect(container.querySelector('#loading')).not.toBeNull();

    resolveFirst('user1');
    await firstPromise;
    expect(container.querySelector('#result')!.textContent).toBe('1:user1');

    // Change the dep – should re-run the promise
    setId!(2);
    expect(fetchCount).toBe(2);
    expect(container.querySelector('#loading')).not.toBeNull();

    resolveSecond('user2');
    await secondPromise;
    expect(container.querySelector('#result')!.textContent).toBe('2:user2');
  });

  it('stale promise result is ignored when deps change before it resolves', async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>(res => { resolveFirst = res; });
    const secondPromise = new Promise<string>(res => { resolveSecond = res; });

    let setId: ((v: number) => void) | null = null;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const data = yield* usePromise({
        fn: () => id === 1 ? firstPromise : secondPromise,
        loading: createElement('span', { id: 'loading' }, 'Loading…'),
        error: createElement('span', null, 'Error'),
        deps: [id],
      });
      return createElement('p', { id: 'result' }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector('#loading')).not.toBeNull();

    // Change dep before first promise resolves
    setId!(2);
    expect(container.querySelector('#loading')).not.toBeNull();

    // Resolve second promise first
    resolveSecond('user2');
    await secondPromise;
    expect(container.querySelector('#result')!.textContent).toBe('2:user2');

    // Now resolve the stale first promise – should NOT update the DOM
    resolveFirst('user1');
    await firstPromise;
    expect(container.querySelector('#result')!.textContent).toBe('2:user2');
  });
});

describe('buildNode', () => {
  it('returns a text node for strings', () => {
    const node = buildNode('hello');
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe('hello');
  });

  it('returns a text node for numbers', () => {
    const node = buildNode(42);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe('42');
  });

  it('returns an empty text node for null', () => {
    const node = buildNode(null);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe('');
  });

  it('returns an empty text node for false', () => {
    const node = buildNode(false);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe('');
  });
});
