import { createElement, Fragment } from '../../jsx';
import { render, buildNode } from '../../render';
import { useState } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('render – HTML elements', () => {
  const container = setupContainer();

  it('renders a plain element', () => {
    render(createElement('div', null), container.current);
    expect(container.current.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it('renders a text child', () => {
    render(createElement('p', null, 'Hello World'), container.current);
    expect(container.current.querySelector('p')!.textContent).toBe('Hello World');
  });

  it('renders nested elements', () => {
    render(createElement('div', null, createElement('span', null, 'inner')), container.current);
    expect(container.current.querySelector('span')!.textContent).toBe('inner');
  });

  it('applies className', () => {
    render(createElement('div', { className: 'foo bar' }), container.current);
    expect((container.current.firstChild as HTMLElement).className).toBe('foo bar');
  });

  it('applies arbitrary attributes', () => {
    render(createElement('input', { type: 'text', placeholder: 'name' }), container.current);
    const input = container.current.querySelector('input')!;
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('placeholder')).toBe('name');
  });

  it('applies event listeners and wraps in SyntheticEvent', () => {
    const onClick = jest.fn();
    render(createElement('button', { onClick }, 'click me'), container.current);
    container.current.querySelector('button')!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    const syntheticEvent = onClick.mock.calls[0][0];
    expect(syntheticEvent).toHaveProperty('nativeEvent');
    expect(syntheticEvent).toHaveProperty('type', 'click');
    expect(typeof syntheticEvent.preventDefault).toBe('function');
    expect(typeof syntheticEvent.stopPropagation).toBe('function');
  });

  it('applies inline styles', () => {
    render(createElement('div', { style: { color: 'red', fontSize: '14px' } }), container.current);
    const el = container.current.firstChild as HTMLElement;
    expect(el.style.color).toBe('red');
    expect(el.style.fontSize).toBe('14px');
  });

  it('renders a Fragment with multiple children', () => {
    render(
      createElement(
        'ul',
        null,
        createElement(
          Fragment,
          null,
          createElement('li', null, 'one'),
          createElement('li', null, 'two'),
        ),
      ),
      container.current,
    );
    const items = container.current.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('one');
    expect(items[1].textContent).toBe('two');
  });

  it('skips null and undefined children', () => {
    render(createElement('div', null, null, undefined, 'visible'), container.current);
    expect(container.current.querySelector('div')!.textContent).toBe('visible');
  });

  it('sets input value as DOM property (not just attribute)', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Controlled() {
      const [val, sv] = yield* useState('initial');
      setValue = sv;
      return createElement('input', { type: 'text', value: val });
    }

    render(createElement(Controlled as never, {}), container.current);
    const input = container.current.querySelector('input') as HTMLInputElement;
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

    render(createElement(CheckBox as never, {}), container.current);
    const cb = container.current.querySelector('input') as HTMLInputElement;
    expect(cb.checked).toBe(false);

    setChecked!(true);
    expect(cb.checked).toBe(true);

    setChecked!(false);
    expect(cb.checked).toBe(false);
  });
});

describe('render – plain function components', () => {
  const container = setupContainer();

  it('calls the function and renders the returned JSX', () => {
    function Greeting({ name }: { name: string }) {
      return createElement('h1', null, `Hello, ${name}!`);
    }
    render(createElement(Greeting as never, { name: 'World' }), container.current);
    expect(container.current.querySelector('h1')!.textContent).toBe('Hello, World!');
  });

  it('renders an empty host when the component returns null', () => {
    function Empty() {
      return null;
    }
    render(createElement(Empty as never, {}), container.current);
    const host = container.current.firstChild as HTMLElement;
    expect(host.childElementCount).toBe(0);
  });

  it('renders an empty host when the component returns undefined', () => {
    function Empty() {
      return undefined;
    }
    render(createElement(Empty as never, {}), container.current);
    const host = container.current.firstChild as HTMLElement;
    expect(host.childElementCount).toBe(0);
  });
});

describe('render – generator components', () => {
  const container = setupContainer();

  it('renders a generator component that returns JSX', () => {
    function* Greeting({ name }: { name: string }) {
      return createElement('h2', null, `Hi, ${name}!`);
    }
    render(createElement(Greeting as never, { name: 'Alice' }), container.current);
    expect(container.current.querySelector('h2')!.textContent).toBe('Hi, Alice!');
  });

  it('rerenders via useState setter', () => {
    let setCount: ((v: number) => void) | null = null;

    function* Counter() {
      const [count, sc] = yield* useState(0);
      setCount = sc;
      return createElement('button', {}, String(count));
    }

    render(createElement(Counter as never, {}), container.current);
    expect(container.current.querySelector('button')!.textContent).toBe('0');

    setCount!(1);
    expect(container.current.querySelector('button')!.textContent).toBe('1');

    setCount!(5);
    expect(container.current.querySelector('button')!.textContent).toBe('5');
  });

  it('rerenders when rerender() is called directly from an event handler', () => {
    function* Counter(_props: Record<string, unknown>) {
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

    render(createElement(Counter as never, {}), container.current);

    expect(container.current.querySelector('button')!.textContent).toBe('0');
    container.current.querySelector('button')!.click();
    expect(container.current.querySelector('button')!.textContent).toBe('1');
    container.current.querySelector('button')!.click();
    expect(container.current.querySelector('button')!.textContent).toBe('2');
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
      container.current,
    );

    expect(container.current.querySelector('span')!.textContent).toBe('nested');
  });

  it('passes children in props', () => {
    function* Wrapper({ children }: { children: unknown }) {
      return createElement('section', null, ...(children as never[]));
    }

    render(
      createElement(Wrapper as never, {}, createElement('p', null, 'child content')),
      container.current,
    );

    expect(container.current.querySelector('p')!.textContent).toBe('child content');
  });
});

describe('render – generator components with useState', () => {
  const container = setupContainer();

  it('useState persists value across re-renders', () => {
    let setLabel: ((v: string) => void) | null = null;

    function* Label() {
      const [text, st] = yield* useState('initial');
      setLabel = st;
      return createElement('p', null, text);
    }

    render(createElement(Label as never, {}), container.current);
    expect(container.current.querySelector('p')!.textContent).toBe('initial');

    setLabel!('updated');
    expect(container.current.querySelector('p')!.textContent).toBe('updated');

    setLabel!('again');
    expect(container.current.querySelector('p')!.textContent).toBe('again');
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

    render(createElement(Multi as never, {}), container.current);
    expect(container.current.querySelector('p')!.textContent).toBe('hello-0');

    setA!('world');
    expect(container.current.querySelector('p')!.textContent).toBe('world-0');

    setB!(42);
    expect(container.current.querySelector('p')!.textContent).toBe('world-42');
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

describe('render – HTML defaults', () => {
  it('sets button type to "button" when not specified', () => {
    const node = buildNode(createElement('button', {}, 'Click')) as HTMLButtonElement;
    expect(node.getAttribute('type')).toBe('button');
  });

  it('preserves explicit button type', () => {
    const node = buildNode(
      createElement('button', { type: 'submit' }, 'Submit'),
    ) as HTMLButtonElement;
    expect(node.getAttribute('type')).toBe('submit');
  });

  it('warns when <a target="_blank"> has no rel', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    buildNode(createElement('a', { href: 'https://example.com', target: '_blank' }, 'link'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('noopener'));
    warn.mockRestore();
  });

  it('does not warn when <a target="_blank"> has any rel value', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    buildNode(
      createElement(
        'a',
        { href: 'https://example.com', target: '_blank', rel: 'noopener noreferrer' },
        'link',
      ),
    );
    buildNode(
      createElement(
        'a',
        { href: 'https://example.com', target: '_blank', rel: 'noreferrer' },
        'link',
      ),
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn for <a> without target="_blank"', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    buildNode(createElement('a', { href: 'https://example.com' }, 'link'));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
