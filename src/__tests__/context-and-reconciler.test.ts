import { createElement, Fragment } from '../jsx';
import { createContext, useContext } from '../context';
import { render, buildNode } from '../render';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

// ---------------------------------------------------------------------------
// Context tests
// ---------------------------------------------------------------------------

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
      const value = useContext(Ctx);
      yield createElement('span', null, value);
    }

    render(createElement(Consumer as never, {}), container);
    expect(container.querySelector('span')!.textContent).toBe('default');
  });

  it('passes a value through Context.Provider to a consumer component', () => {
    const Ctx = createContext('default');

    function* Consumer() {
      const value = useContext(Ctx);
      yield createElement('span', null, value);
    }

    render(
      createElement(Ctx.Provider as never, { value: 'provided' },
        createElement(Consumer as never, {})
      ),
      container
    );
    expect(container.querySelector('span')!.textContent).toBe('provided');
  });

  it('nested Providers shadow the outer value', () => {
    const Ctx = createContext('outer');

    function* Consumer() {
      const value = useContext(Ctx);
      yield createElement('span', null, value);
    }

    render(
      createElement(Ctx.Provider as never, { value: 'outer' },
        createElement('div', null,
          createElement(Ctx.Provider as never, { value: 'inner' },
            createElement(Consumer as never, {})
          )
        )
      ),
      container
    );
    expect(container.querySelector('span')!.textContent).toBe('inner');
  });

  it('consumer outside Provider still gets default value', () => {
    const Ctx = createContext(42);

    function* Consumer() {
      const val = useContext(Ctx);
      yield createElement('span', null, String(val));
    }

    render(
      createElement('div', null,
        createElement(Ctx.Provider as never, { value: 99 },
          createElement('span', { id: 'inside' }, 'ignored')
        ),
        createElement(Consumer as never, {})
      ),
      container
    );
    // Consumer is outside Provider so it should use the default (42)
    const spans = container.querySelectorAll('span');
    const consumerSpan = Array.from(spans).find(s => s.textContent === '42');
    expect(consumerSpan).toBeTruthy();
  });

  it('generator component can read context at every yield', () => {
    const Ctx = createContext(0);

    function* Consumer(_: Record<string, unknown>, rerender: () => void) {
      while (true) {
        const val = useContext(Ctx);
        yield createElement('span', null, String(val));
      }
    }

    render(
      createElement(Ctx.Provider as never, { value: 7 },
        createElement(Consumer as never, {})
      ),
      container
    );
    expect(container.querySelector('span')!.textContent).toBe('7');
  });
});

// ---------------------------------------------------------------------------
// Prop memoization (no re-render if props unchanged)
// ---------------------------------------------------------------------------

describe('prop memoization', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('does not re-mount a child component when the parent re-renders with unchanged child props', () => {
    let mountCount = 0;

    function* Child({ label }: { label: string }) {
      mountCount++;
      yield createElement('span', null, label);
    }

    function* Parent(_: Record<string, unknown>, rerender: () => void) {
      // First yield
      yield createElement('div', null,
        createElement(Child as never, { label: 'hello' })
      );
      // Second yield (same props for Child)
      yield createElement('div', null,
        createElement(Child as never, { label: 'hello' })
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(mountCount).toBe(1);
    expect(container.querySelector('span')!.textContent).toBe('hello');

    // Advance generator (simulated via the rerender held inside a closure)
    // We can trigger rerender by reading the component's inner rerender via
    // a button click pattern:
    let parentRerender: (() => void) | null = null;

    function* ParentWithTrigger(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      yield createElement('div', null,
        createElement(Child as never, { label: 'hello' })
      );
      yield createElement('div', null,
        createElement(Child as never, { label: 'hello' })
      );
    }

    const container2 = document.createElement('div');
    document.body.appendChild(container2);
    mountCount = 0;
    render(createElement(ParentWithTrigger as never, {}), container2);
    expect(mountCount).toBe(1);

    parentRerender!();
    // Child was NOT remounted (same props)
    expect(mountCount).toBe(1);
    document.body.removeChild(container2);
  });

  it('remounts a child component when props change', () => {
    let mountCount = 0;
    let parentRerender: (() => void) | null = null;

    function* Child({ label }: { label: string }) {
      mountCount++;
      yield createElement('span', null, label);
    }

    function* Parent(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      yield createElement('div', null,
        createElement(Child as never, { label: 'first' })
      );
      yield createElement('div', null,
        createElement(Child as never, { label: 'second' })
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(mountCount).toBe(1);
    expect(container.querySelector('span')!.textContent).toBe('first');

    parentRerender!();
    expect(mountCount).toBe(2);
    expect(container.querySelector('span')!.textContent).toBe('second');
  });
});

// ---------------------------------------------------------------------------
// Component renders other components (lifecycle managed by parent)
// ---------------------------------------------------------------------------

describe('component renders component', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('generator renders a plain component child', () => {
    function Greeting({ name }: { name: string }) {
      return createElement('h1', null, `Hello, ${name}!`);
    }

    function* App() {
      yield createElement('div', null,
        createElement(Greeting as never, { name: 'World' })
      );
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector('h1')!.textContent).toBe('Hello, World!');
  });

  it('generator renders a generator component child', () => {
    function* Label({ text }: { text: string }) {
      yield createElement('em', null, text);
    }

    function* App() {
      yield createElement('div', null,
        createElement(Label as never, { text: 'from-child' })
      );
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector('em')!.textContent).toBe('from-child');
  });

  it('child generator component maintains its own state across parent re-renders', () => {
    let childRerender: (() => void) | null = null;
    let parentRerender: (() => void) | null = null;

    function* Counter(_: Record<string, unknown>, rerender: () => void) {
      childRerender = rerender;
      let count = 0;
      while (true) {
        yield createElement('span', { id: 'counter' }, String(count));
        count++;
      }
    }

    function* Wrapper(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      while (true) {
        yield createElement('div', null,
          createElement(Counter as never, {})
        );
      }
    }

    render(createElement(Wrapper as never, {}), container);
    expect(container.querySelector('#counter')!.textContent).toBe('0');

    // Increment child
    childRerender!();
    expect(container.querySelector('#counter')!.textContent).toBe('1');

    // Parent re-renders with SAME Counter props → child is reused
    parentRerender!();
    // Counter state is preserved (still at 1)
    expect(container.querySelector('#counter')!.textContent).toBe('1');
  });

  it('parent switching child component type unmounts old and mounts new', () => {
    let parentRerender: (() => void) | null = null;
    let phase = 0;

    function* CompA() {
      yield createElement('span', { id: 'a' }, 'A');
    }
    function* CompB() {
      yield createElement('span', { id: 'b' }, 'B');
    }

    function* Parent(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      yield createElement('div', null, phase === 0
        ? createElement(CompA as never, {})
        : createElement(CompB as never, {})
      );
      yield createElement('div', null, phase === 0
        ? createElement(CompA as never, {})
        : createElement(CompB as never, {})
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#a')).not.toBeNull();
    expect(container.querySelector('#b')).toBeNull();

    phase = 1;
    parentRerender!();
    expect(container.querySelector('#a')).toBeNull();
    expect(container.querySelector('#b')).not.toBeNull();
  });

  it('reconciles HTML element children in place across re-renders', () => {
    let rerender: (() => void) | null = null;
    let step = 0;

    function* App(_: Record<string, unknown>, r: () => void) {
      rerender = r;
      yield createElement('p', { className: 'first' }, 'hello');
      yield createElement('p', { className: 'second' }, 'world');
    }

    render(createElement(App as never, {}), container);
    const p = container.querySelector('p')!;
    expect(p.className).toBe('first');
    expect(p.textContent).toBe('hello');

    rerender!();
    // Same <p> element is reused (updated in place)
    expect(container.querySelector('p')).toBe(p);
    expect(p.className).toBe('second');
    expect(p.textContent).toBe('world');
  });

  it('generator renders Fragment with multiple component children', () => {
    function* A() { yield createElement('span', { id: 'a' }, 'A'); }
    function* B() { yield createElement('span', { id: 'b' }, 'B'); }

    function* App() {
      yield createElement(Fragment, null,
        createElement(A as never, {}),
        createElement(B as never, {})
      );
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector('#a')!.textContent).toBe('A');
    expect(container.querySelector('#b')!.textContent).toBe('B');
  });
});
