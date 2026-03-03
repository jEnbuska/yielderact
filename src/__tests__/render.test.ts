import { createElement, Fragment } from '../jsx';
import { render, buildNode } from '../render';

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

  it('applies event listeners', () => {
    const onClick = jest.fn();
    render(createElement('button', { onClick }, 'click me'), container);
    container.querySelector('button')!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
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
    // The host span is present but has no element children
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

  it('renders the initial yield', () => {
    function* Greeting({ name }: { name: string }) {
      yield createElement('h2', null, `Hi, ${name}!`);
    }
    render(createElement(Greeting as never, { name: 'Alice' }), container);
    expect(container.querySelector('h2')!.textContent).toBe('Hi, Alice!');
  });

  it('rerenders when rerender() is called from an event handler', () => {
    function* Counter(_props: Record<string, unknown>, rerender: () => void) {
      let count = 0;
      while (true) {
        yield createElement(
          'button',
          { onClick: () => { count++; rerender(); } },
          String(count)
        );
      }
    }

    render(createElement(Counter as never, {}), container);

    expect(container.querySelector('button')!.textContent).toBe('0');
    container.querySelector('button')!.click();
    expect(container.querySelector('button')!.textContent).toBe('1');
    container.querySelector('button')!.click();
    expect(container.querySelector('button')!.textContent).toBe('2');
  });

  it('stops rerendering when the generator is exhausted', () => {
    function* Once(_props: Record<string, unknown>, rerender: () => void) {
      yield createElement('p', null, 'first');
      rerender(); // should be a no-op because generator is done after this
    }

    render(createElement(Once as never, {}), container);
    // 'first' was rendered; calling rerender inside the component exhausted
    // the generator so the host keeps showing 'first'
    expect(container.querySelector('p')!.textContent).toBe('first');
  });

  it('renders generator components nested inside HTML elements', () => {
    function* Label({ text }: { text: string }) {
      yield createElement('span', null, text);
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
      yield createElement('section', null, ...(children as never[]));
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
