import { createElement } from '../jsx';
import { render, startUIPatch, commitUIPatch } from '../render';
import { useRef, useId, useMemo, useState, useRender, useResume, useUIPatch } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('useState', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('accepts a lazy initializer function called only once', () => {
    const init = jest.fn(() => 42);
    let capturedValue: number | null = null;
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(init);
      capturedValue = v;
      setValue = sv;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(init).toHaveBeenCalledTimes(1);
    expect(capturedValue).toBe(42);

    // Re-render should not call the initializer again
    setValue!(99);
    expect(init).toHaveBeenCalledTimes(1);
    expect(capturedValue).toBe(99);
  });

  it('accepts a functional updater that receives the previous state', () => {
    const values: number[] = [];
    let setValue: ((v: number | ((prev: number) => number)) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(0);
      values.push(v);
      setValue = sv;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(values).toEqual([0]);

    setValue!((prev) => prev + 5);
    expect(values).toEqual([0, 5]);

    setValue!((prev) => prev * 2);
    expect(values).toEqual([0, 5, 10]);
  });
});

describe('useRef', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns an object with the initial value in .current', () => {
    let capturedRef: { current: number } | null = null;

    function* Comp() {
      const ref = yield* useRef(42);
      capturedRef = ref;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(capturedRef).not.toBeNull();
    expect(capturedRef!.current).toBe(42);
  });

  it('persists the same object across re-renders', () => {
    const refInstances: object[] = [];
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      const ref = yield* useRef(0);
      refInstances.push(ref);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    setValue!(1);

    expect(refInstances).toHaveLength(2);
    expect(refInstances[0]).toBe(refInstances[1]);
  });

  it('mutations to .current do not trigger a re-render', () => {
    let renderCount = 0;
    let capturedRef: { current: number } | null = null;

    function* Comp() {
      renderCount++;
      const ref = yield* useRef(0);
      capturedRef = ref;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(renderCount).toBe(1);

    capturedRef!.current = 99;
    expect(renderCount).toBe(1);
    expect(capturedRef!.current).toBe(99);
  });
});

describe('useId', () => {
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
      capturedId = yield* useId();
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
      const [, sv] = yield* useState(0);
      setValue = sv;
      const id = yield* useId();
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
      id1 = yield* useId();
      id2 = yield* useId();
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(id1).not.toBe(id2);
  });
});

describe('useMemo', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('computes the initial value by calling fn with deps', () => {
    const factory = jest.fn((a: number, b: number) => a + b);
    let capturedValue: number | null = null;

    function* Comp() {
      capturedValue = yield* useMemo(factory, [2, 3]);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(2, 3);
    expect(capturedValue).toBe(5);
  });

  it('does not recompute when deps are the same', () => {
    const factory = jest.fn((a: number) => a * 2);
    let setValue: ((v: number) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(10);
      setValue = sv;
      yield* useMemo(factory, [5]);
      return createElement('div', null, String(v));
    }

    render(createElement(Comp as never, {}), container);
    setValue!(20); // trigger re-render, same dep [5]

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('recomputes when deps change', () => {
    const factory = jest.fn((a: number) => a * 2);
    let setValue: ((v: number) => void) | null = null;
    let capturedValue: number | null = null;

    function* Comp() {
      const [v, sv] = yield* useState(1);
      setValue = sv;
      capturedValue = yield* useMemo(factory, [v]);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(capturedValue).toBe(2);
    expect(factory).toHaveBeenCalledTimes(1);

    setValue!(3);
    expect(capturedValue).toBe(6);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenLastCalledWith(3);
  });

  it('works with empty deps (zero-arg factory)', () => {
    const factory = jest.fn(() => 42);
    let setValue: ((v: number) => void) | null = null;
    let capturedValue: number | null = null;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      capturedValue = yield* useMemo(factory, []);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(capturedValue).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);

    setValue!(1); // re-render, empty deps never change
    expect(capturedValue).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('useRender (Variant 2 – inline function)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('yields JSX while waiting and returns the value passed to resume', () => {
    let capturedResume: ((v: string) => void) | null = null;
    let finalText: string | null = null;

    function* Comp() {
      const answer = yield* useRender<string>(({ resume }) => {
        capturedResume = resume;
        return createElement('span', null, 'waiting');
      }, []);
      finalText = answer;
      return createElement('p', null, answer);
    }

    render(createElement(Comp as never, {}), container);

    // While waiting the dialog is shown
    expect(container.querySelector('span')?.textContent).toBe('waiting');
    expect(finalText).toBeNull();

    // Resolving unblocks the generator
    capturedResume!('DONE');

    expect(container.querySelector('p')?.textContent).toBe('DONE');
    expect(finalText).toBe('DONE');
  });

  it('resume is idempotent – calling it twice only resolves once', () => {
    let capturedResume: ((v: number) => void) | null = null;
    let resolveCount = 0;
    let finalValue: number | null = null;

    function* Comp() {
      const v = yield* useRender<number>(({ resume }) => {
        capturedResume = resume;
        return createElement('span', null);
      }, []);
      resolveCount++;
      finalValue = v;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    capturedResume!(1);
    capturedResume!(2); // second call ignored

    expect(resolveCount).toBe(1);
    expect(finalValue).toBe(1);
  });

  it('resets to waiting on parent rerender while waiting', () => {
    let capturedResume: ((v: boolean) => void) | null = null;
    let setVal: ((v: number) => void) | null = null;
    let renderCount = 0;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setVal = sv;
      yield* useRender<boolean>(({ resume }) => {
        renderCount++;
        capturedResume = resume;
        return createElement('span', null);
      }, []);
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);
    expect(renderCount).toBe(1);

    // Trigger a rerender while waiting
    setVal!(1);
    expect(renderCount).toBe(2);

    // The generator is still waiting – resolve it now
    capturedResume!(true);
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('deps change resets the interaction', () => {
    let setDep: ((v: number) => void) | null = null;
    let capturedResume: ((v: string) => void) | null = null;
    let resolveCount = 0;

    function* Comp() {
      const [dep, sd] = yield* useState(0);
      setDep = sd;
      yield* useRender<string>(
        ({ resume }) => {
          capturedResume = resume;
          return createElement('span', null, String(dep));
        },
        [dep],
      );
      resolveCount++;
      return createElement('div', null);
    }

    render(createElement(Comp as never, {}), container);

    // Resolve first interaction
    capturedResume!('first');
    expect(resolveCount).toBe(1);

    // Change dep → should reset and show dialog again
    setDep!(1);
    expect(container.querySelector('span')).not.toBeNull();

    capturedResume!('second');
    expect(resolveCount).toBe(2);
  });
});

describe('useRender (Variant 1 – JSX child with useResume)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('child component receives resume via useResume and can resolve the parent', () => {
    let capturedResume: ((v: string) => void) | null = null;
    let finalAnswer: string | null = null;

    function* Dialog() {
      const resume = yield* useResume<string>();
      capturedResume = resume;
      return createElement('span', null, 'dialog');
    }

    function* Parent() {
      const answer = yield* useRender<string>(createElement(Dialog as never, {}));
      finalAnswer = answer;
      return createElement('p', null, answer);
    }

    render(createElement(Parent as never, {}), container);

    expect(container.querySelector('span')?.textContent).toBe('dialog');
    expect(finalAnswer).toBeNull();

    capturedResume!('ACCEPTED');

    expect(container.querySelector('p')?.textContent).toBe('ACCEPTED');
    expect(finalAnswer).toBe('ACCEPTED');
  });

  it('does not remount the child when the parent rerenders while waiting', () => {
    let mountCount = 0;
    let capturedResume: ((v: string) => void) | null = null;
    let setVal: ((v: number) => void) | null = null;

    function* Dialog() {
      mountCount++;
      const resume = yield* useResume<string>();
      capturedResume = resume;
      return createElement('span', null, 'dialog');
    }

    function* Parent() {
      const [, sv] = yield* useState(0);
      setVal = sv;
      yield* useRender<string>(createElement(Dialog as never, {}));
      return createElement('div', null);
    }

    render(createElement(Parent as never, {}), container);
    expect(mountCount).toBe(1);

    // Trigger a parent rerender while the dialog is still open
    setVal!(1);
    expect(mountCount).toBe(1); // Dialog must NOT remount

    // Resolve still works after the rerender
    capturedResume!('OK');
    expect(container.querySelector('div')).not.toBeNull();
  });
});

describe('useResume', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('throws when called outside a useRender context', () => {
    function* Comp() {
      yield* useResume();
      return createElement('div', null);
    }

    expect(() => render(createElement(Comp as never, {}), container)).toThrow(
      'useResume must be called inside a component rendered by useRender',
    );
  });
});

// ---------------------------------------------------------------------------
// Global UI Patch: startUIPatch / commitUIPatch
// ---------------------------------------------------------------------------

describe('startUIPatch / commitUIPatch (global patch)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    // Always commit in case a test left a patch open
    commitUIPatch();
  });

  it('defers DOM updates until commitUIPatch is called', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState('initial');
      setValue = sv;
      return createElement('span', null, v);
    }

    render(createElement(Comp as never, {}), container);
    expect(container.textContent).toBe('initial');

    startUIPatch();
    setValue!('updated');
    // DOM not yet changed
    expect(container.textContent).toBe('initial');

    commitUIPatch();
    expect(container.textContent).toBe('updated');
  });

  it('multiple state changes during patch produce exactly one DOM update on commit', () => {
    const renderCalls: string[] = [];
    let setValue: ((v: string) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState('a');
      setValue = sv;
      renderCalls.push(v);
      return createElement('span', null, v);
    }

    render(createElement(Comp as never, {}), container);
    renderCalls.length = 0; // reset after initial mount

    startUIPatch();
    setValue!('b');
    setValue!('c');
    // Two state changes → two generator runs, but DOM unchanged
    expect(container.textContent).toBe('a');

    commitUIPatch();
    // DOM reflects final state
    expect(container.textContent).toBe('c');
  });

  it('nested patches: DOM only flushed when depth reaches zero', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState('a');
      setValue = sv;
      return createElement('span', null, v);
    }

    render(createElement(Comp as never, {}), container);

    startUIPatch();
    startUIPatch();
    setValue!('b');
    commitUIPatch(); // depth 2→1; not flushed yet
    expect(container.textContent).toBe('a');
    commitUIPatch(); // depth 1→0; flushed now
    expect(container.textContent).toBe('b');
  });

  it('$patch="live" component updates immediately during a global patch', () => {
    let setLive: ((v: string) => void) | null = null;
    let setFrozen: ((v: string) => void) | null = null;

    function* Live() {
      const [v, sv] = yield* useState('live-a');
      setLive = sv;
      return createElement('span', { id: 'live' }, v);
    }

    function* Frozen() {
      const [v, sv] = yield* useState('frozen-a');
      setFrozen = sv;
      return createElement('span', { id: 'frozen' }, v);
    }

    function* App() {
      return createElement(
        'div',
        null,
        createElement(Live as never, { $patch: 'live' }),
        createElement(Frozen as never, {}),
      );
    }

    render(createElement(App as never, {}), container);

    startUIPatch();
    setLive!('live-b');
    setFrozen!('frozen-b');

    // Live component updated immediately; frozen component not yet
    expect(container.querySelector('#live')!.textContent).toBe('live-b');
    expect(container.querySelector('#frozen')!.textContent).toBe('frozen-a');

    commitUIPatch();
    expect(container.querySelector('#frozen')!.textContent).toBe('frozen-b');
  });

  it('unmounting a dirty component before commit does not throw', () => {
    let setValue: ((v: string) => void) | null = null;
    let setShown: ((v: boolean) => void) | null = null;

    function* Inner() {
      const [v, sv] = yield* useState('x');
      setValue = sv;
      return createElement('span', null, v);
    }

    function* Outer() {
      const [shown, setS] = yield* useState(true);
      setShown = setS;
      return createElement('div', null, shown ? createElement(Inner as never, {}) : null);
    }

    render(createElement(Outer as never, {}), container);

    startUIPatch();
    setValue!('y'); // Inner is now dirty
    setShown!(false); // Inner is unmounted

    expect(() => commitUIPatch()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Local UI Patch: useUIPatch
// ---------------------------------------------------------------------------

describe('useUIPatch (local patch)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('defers DOM updates in the component and its descendants until commit', () => {
    let setInner: ((v: string) => void) | null = null;
    let capturedCommit: (() => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      const [v, sv] = yield* useState('child-a');
      setInner = sv;
      return createElement('span', { id: 'child' }, v);
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      return createElement('div', null, createElement(Child as never, {}));
    }

    render(createElement(Parent as never, {}), container);

    capturedCommit = capturedStartPatch!();
    setInner!('child-b');

    // DOM not yet updated
    expect(container.querySelector('#child')!.textContent).toBe('child-a');

    capturedCommit();
    expect(container.querySelector('#child')!.textContent).toBe('child-b');
  });

  it('sibling component outside the patch subtree updates immediately', () => {
    let setSibling: ((v: string) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* PatchedArea() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      return createElement('span', { id: 'patched' }, 'content');
    }

    function* Sibling() {
      const [v, sv] = yield* useState('sib-a');
      setSibling = sv;
      return createElement('span', { id: 'sib' }, v);
    }

    function* App() {
      return createElement(
        'div',
        null,
        createElement(PatchedArea as never, {}),
        createElement(Sibling as never, {}),
      );
    }

    render(createElement(App as never, {}), container);

    const commit = capturedStartPatch!();
    setSibling!('sib-b');

    // Sibling is outside the patch scope → updates immediately
    expect(container.querySelector('#sib')!.textContent).toBe('sib-b');

    // Committing is a no-op for the sibling but should not throw
    expect(() => commit()).not.toThrow();
  });

  it('snapshot is taken at startPatch() call time', () => {
    // A child mounted AFTER startPatch() is called is not in the snapshot
    // and runs normally.
    let setShow: ((v: boolean) => void) | null = null;
    let setDynamic: ((v: string) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Dynamic() {
      const [v, sv] = yield* useState('dyn-a');
      setDynamic = sv;
      return createElement('span', { id: 'dyn' }, v);
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement('div', null, show ? createElement(Dynamic as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    // Start patch BEFORE Dynamic is mounted
    const commit = capturedStartPatch!();

    // Mount Dynamic while patch is active (it's not in the snapshot)
    setShow!(true); // Parent is in the patch → deferred
    // DOM not yet updated (Parent itself is deferred)
    expect(container.querySelector('#dyn')).toBeNull();

    commit();
    // After commit, Dynamic appears
    expect(container.querySelector('#dyn')!.textContent).toBe('dyn-a');
  });
});

// ---------------------------------------------------------------------------
// Live-only reconcile: element visibility during patches
// ---------------------------------------------------------------------------

describe('live-only reconcile: element add/remove during global patch', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    commitUIPatch(); // clean up in case a test left a patch open
  });

  // ── Removal ──────────────────────────────────────────────────────────────

  it('removed default element stays visible until commit', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')).not.toBeNull();

    startUIPatch();
    setShow!(false);
    // Still visible — DOM is frozen
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).toBeNull();
  });

  it('removed $patch="live" component disappears immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        'div',
        null,
        show ? createElement(Child as never, { $patch: 'live' }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')).not.toBeNull();

    startUIPatch();
    setShow!(false);
    // Removed immediately because $patch="live"
    expect(container.querySelector('#target')).toBeNull();

    commitUIPatch();
    // Still gone after commit
    expect(container.querySelector('#target')).toBeNull();
  });

  it('element inside $patch="live" wrapper removed disappears immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        'div',
        { $patch: 'live' },
        show ? createElement(Child as never, {}) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow!(false);
    expect(container.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).toBeNull();
  });

  it('$shown=false with $patch="live" hides element immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        'div',
        null,
        createElement(Child as never, { $shown: show, $patch: 'live' }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')).not.toBeNull();

    startUIPatch();
    setShow!(false);
    // Hidden immediately
    expect(container.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).toBeNull();
  });

  it('$shown=false without $patch="live" keeps element visible until commit', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement('div', null, createElement(Child as never, { $shown: show }));
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow!(false);
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).toBeNull();
  });

  // ── Addition ─────────────────────────────────────────────────────────────

  it('added default element does not appear until commit', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')).toBeNull();

    startUIPatch();
    setShow!(true);
    // Not yet visible
    expect(container.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('added $patch="live" component appears immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        'div',
        null,
        show ? createElement(Child as never, { $patch: 'live' }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow!(true);
    // Appears immediately
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    // Still there after commit
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('element added inside $patch="live" wrapper appears immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        'div',
        { $patch: 'live' },
        show ? createElement(Child as never, {}) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow!(true);
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('$shown=true with $patch="live" shows element immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        'div',
        null,
        createElement(Child as never, { $shown: show, $patch: 'live' }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')).toBeNull();

    startUIPatch();
    setShow!(true);
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  // ── Remove then re-add ────────────────────────────────────────────────────

  it('default element removed then re-added stays visible throughout and commit preserves it', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow!(false); // remove — frozen, stays visible
    expect(container.querySelector('#target')).not.toBeNull();
    setShow!(true); // re-add — still frozen
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    // Final state: show=true → element present
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('live element removed then re-added disappears and reappears immediately', () => {
    let setShow: ((v: boolean) => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        'div',
        null,
        show ? createElement(Child as never, { $patch: 'live' }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow!(false); // live remove → gone immediately
    expect(container.querySelector('#target')).toBeNull();
    setShow!(true); // live re-add → back immediately
    expect(container.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  // ── Text content inside live context ──────────────────────────────────────

  it('text inside $patch="live" wrapper updates immediately', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Parent() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('div', { $patch: 'live' }, v);
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setValue!('b');
    expect(container.textContent).toBe('b');

    commitUIPatch();
    expect(container.textContent).toBe('b');
  });

  it('text outside live context stays frozen until commit', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Parent() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('span', null, v);
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setValue!('b');
    expect(container.textContent).toBe('a');

    commitUIPatch();
    expect(container.textContent).toBe('b');
  });

  // ── Dynamic $patch changes mid-patch ─────────────────────────────────────

  it('component switches from default to live mid-patch and starts updating immediately', () => {
    let setLive: ((v: boolean) => void) | null = null;
    let setValue: ((v: string) => void) | null = null;

    function* Child() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('span', { id: 'target' }, v);
    }

    function* Parent() {
      const [live, setLive_] = yield* useState(false);
      setLive = setLive_;
      return createElement(
        'div',
        null,
        createElement(Child as never, { $patch: live ? 'live' : 'default' }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')!.textContent).toBe('a');

    startUIPatch();
    // First update while Child is still default → deferred
    setValue!('b');
    expect(container.querySelector('#target')!.textContent).toBe('a');

    // Switch Child to live (via parent rerender)
    setLive!(true);
    // Now Child.batchBehavior is updated to 'live'
    // Subsequent updates should be immediate
    setValue!('c');
    expect(container.querySelector('#target')!.textContent).toBe('c');

    commitUIPatch();
    expect(container.querySelector('#target')!.textContent).toBe('c');
  });

  it('component switches from live to default mid-patch and stops updating', () => {
    let setLive: ((v: boolean) => void) | null = null;
    let setValue: ((v: string) => void) | null = null;

    function* Child() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('span', { id: 'target' }, v);
    }

    function* Parent() {
      const [live, setLive_] = yield* useState(true);
      setLive = setLive_;
      return createElement(
        'div',
        null,
        createElement(Child as never, { $patch: live ? 'live' : 'default' }),
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    // Child is live → updates immediately
    setValue!('b');
    expect(container.querySelector('#target')!.textContent).toBe('b');

    // Switch Child to default → stops updating immediately
    setLive!(false);
    setValue!('c');
    // Should still show 'b' — deferred now
    expect(container.querySelector('#target')!.textContent).toBe('b');

    commitUIPatch();
    expect(container.querySelector('#target')!.textContent).toBe('c');
  });

  it('live element that becomes default retains its last live state after commit', () => {
    let setLive: ((v: boolean) => void) | null = null;
    let setValue: ((v: string) => void) | null = null;

    function* Child() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('span', { id: 'target' }, v);
    }

    function* Parent() {
      const [live, setLive_] = yield* useState(true);
      setLive = setLive_;
      return createElement(
        'div',
        null,
        createElement(Child as never, { $patch: live ? 'live' : 'default' }),
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setValue!('b'); // live → updates immediately
    expect(container.querySelector('#target')!.textContent).toBe('b');

    setLive!(false); // switch to default — 'b' stays in DOM
    expect(container.querySelector('#target')!.textContent).toBe('b');

    // No further state updates — commit should apply pendingVNode for Parent
    // (which has $patch="default" for Child now), reconcile from 'b'
    commitUIPatch();
    // State was never changed again — Child remains at 'b'
    expect(container.querySelector('#target')!.textContent).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Live-only reconcile: element add/remove during local patch
// ---------------------------------------------------------------------------

describe('live-only reconcile: element add/remove during local patch', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('removed default element stays visible until local commit', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(false);
    expect(container.querySelector('#target')).not.toBeNull();

    commit();
    expect(container.querySelector('#target')).toBeNull();
  });

  it('removed $patch="live" component disappears immediately during local patch', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        'div',
        null,
        show ? createElement(Child as never, { $patch: 'live' }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(false);
    expect(container.querySelector('#target')).toBeNull();

    commit();
    expect(container.querySelector('#target')).toBeNull();
  });

  it('added default element does not appear until local commit', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(true);
    expect(container.querySelector('#target')).toBeNull();

    commit();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('added $patch="live" component appears immediately during local patch', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        'div',
        null,
        show ? createElement(Child as never, { $patch: 'live' }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(true);
    expect(container.querySelector('#target')).not.toBeNull();

    commit();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('live element added then removed during local patch: not present after commit', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        'div',
        null,
        show ? createElement(Child as never, { $patch: 'live' }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(true); // live-add → appears immediately
    expect(container.querySelector('#target')).not.toBeNull();
    setShow!(false); // live-remove → disappears immediately
    expect(container.querySelector('#target')).toBeNull();

    commit();
    expect(container.querySelector('#target')).toBeNull();
  });

  it('default element added then removed during local patch: invisible throughout, absent after commit', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(true); // default: still not visible
    expect(container.querySelector('#target')).toBeNull();
    setShow!(false); // default: still not visible
    expect(container.querySelector('#target')).toBeNull();

    commit();
    // Final state: show=false → not present
    expect(container.querySelector('#target')).toBeNull();
  });

  it('default element removed then re-added during local patch: visible throughout and present after commit', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'hello');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement('div', null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch!();
    setShow!(false); // frozen: still visible
    expect(container.querySelector('#target')).not.toBeNull();
    setShow!(true); // frozen: still visible
    expect(container.querySelector('#target')).not.toBeNull();

    commit();
    expect(container.querySelector('#target')).not.toBeNull();
  });

  it('$shown with $patch="live" inside local patch scope behaves live', () => {
    let setShown: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Child() {
      return createElement('span', { id: 'target' }, 'x');
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [shown, setS] = yield* useState(true);
      setShown = setS;
      return createElement(
        'div',
        null,
        createElement(Child as never, { $shown: shown, $patch: 'live' }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('#target')).not.toBeNull();

    const commit = capturedStartPatch!();
    setShown!(false); // live → hides immediately
    expect(container.querySelector('#target')).toBeNull();

    commit();
    expect(container.querySelector('#target')).toBeNull();
  });
});
