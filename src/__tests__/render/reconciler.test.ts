import { createElement, Fragment } from '../../jsx';
import { render } from '../../render';
import { useState } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('prop memoization', () => {
  const container = setupContainer();

  it('does not re-mount a child component when the parent re-renders with unchanged child props', () => {
    let mountCount = 0;
    let parentRerender: (() => void) | null = null;

    function* Child({ label }: { label: string }) {
      mountCount++;
      return createElement('span', null, label);
    }

    function* Parent(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      return createElement('div', null, createElement(Child as never, { label: 'hello' }));
    }

    render(createElement(Parent as never, {}), container.current);
    expect(mountCount).toBe(1);
    expect(container.current.querySelector('span')!.textContent).toBe('hello');

    parentRerender!();
    expect(mountCount).toBe(1);
  });

  it('remounts a child component when props change', () => {
    let mountCount = 0;
    let setPhase: ((v: number) => void) | null = null;

    function* Child({ label }: { label: string }) {
      mountCount++;
      return createElement('span', null, label);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        'div',
        null,
        createElement(Child as never, { label: phase === 0 ? 'first' : 'second' }),
      );
    }

    render(createElement(Parent as never, {}), container.current);
    expect(mountCount).toBe(1);
    expect(container.current.querySelector('span')!.textContent).toBe('first');

    setPhase!(1);
    expect(mountCount).toBe(2);
    expect(container.current.querySelector('span')!.textContent).toBe('second');
  });
});

describe('component renders component', () => {
  const container = setupContainer();

  it('generator renders a plain component child', () => {
    function Greeting({ name }: { name: string }) {
      return createElement('h1', null, `Hello, ${name}!`);
    }

    function* App() {
      return createElement('div', null, createElement(Greeting as never, { name: 'World' }));
    }

    render(createElement(App as never, {}), container.current);
    expect(container.current.querySelector('h1')!.textContent).toBe('Hello, World!');
  });

  it('generator renders a generator component child', () => {
    function* Label({ text }: { text: string }) {
      return createElement('em', null, text);
    }

    function* App() {
      return createElement('div', null, createElement(Label as never, { text: 'from-child' }));
    }

    render(createElement(App as never, {}), container.current);
    expect(container.current.querySelector('em')!.textContent).toBe('from-child');
  });

  it('child generator component maintains its own state across parent re-renders', () => {
    let incrementCounter: (() => void) | null = null;
    let parentRerender: (() => void) | null = null;

    function* Counter() {
      const [count, setCount] = yield* useState(0);
      incrementCounter = () => setCount(count + 1);
      return createElement('span', { id: 'counter' }, String(count));
    }

    function* Wrapper(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      return createElement('div', null, createElement(Counter as never, {}));
    }

    render(createElement(Wrapper as never, {}), container.current);
    expect(container.current.querySelector('#counter')!.textContent).toBe('0');

    incrementCounter!();
    expect(container.current.querySelector('#counter')!.textContent).toBe('1');

    parentRerender!();
    expect(container.current.querySelector('#counter')!.textContent).toBe('1');
  });

  it('parent switching child component type unmounts old and mounts new', () => {
    let setPhase: ((v: number) => void) | null = null;

    function* CompA() {
      return createElement('span', { id: 'a' }, 'A');
    }
    function* CompB() {
      return createElement('span', { id: 'b' }, 'B');
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        'div',
        null,
        phase === 0 ? createElement(CompA as never, {}) : createElement(CompB as never, {}),
      );
    }

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#a')).not.toBeNull();
    expect(container.current.querySelector('#b')).toBeNull();

    setPhase!(1);
    expect(container.current.querySelector('#a')).toBeNull();
    expect(container.current.querySelector('#b')).not.toBeNull();
  });

  it('reconciles HTML element children in place across re-renders', () => {
    let setStep: ((v: number) => void) | null = null;

    function* App() {
      const [step, ss] = yield* useState(0);
      setStep = ss;
      return step === 0
        ? createElement('p', { className: 'first' }, 'hello')
        : createElement('p', { className: 'second' }, 'world');
    }

    render(createElement(App as never, {}), container.current);
    const p = container.current.querySelector('p')!;
    expect(p.className).toBe('first');
    expect(p.textContent).toBe('hello');

    setStep!(1);
    expect(container.current.querySelector('p')).toBe(p);
    expect(p.className).toBe('second');
    expect(p.textContent).toBe('world');
  });

  it('generator renders Fragment with multiple component children', () => {
    function* A() {
      return createElement('span', { id: 'a' }, 'A');
    }
    function* B() {
      return createElement('span', { id: 'b' }, 'B');
    }

    function* App() {
      return createElement(
        Fragment,
        null,
        createElement(A as never, {}),
        createElement(B as never, {}),
      );
    }

    render(createElement(App as never, {}), container.current);
    expect(container.current.querySelector('#a')!.textContent).toBe('A');
    expect(container.current.querySelector('#b')!.textContent).toBe('B');
  });
});
