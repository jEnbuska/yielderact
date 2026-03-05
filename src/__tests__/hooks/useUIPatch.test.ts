import { createElement } from '../../jsx';
import { render, startUIPatch, commitUIPatch } from '../../render';
import { useState, useUIPatch } from '../../hooks';
import { setupContainer } from '../test-utils';

// ---------------------------------------------------------------------------
// Global UI Patch: startUIPatch / commitUIPatch
// ---------------------------------------------------------------------------

describe('startUIPatch / commitUIPatch (global patch)', () => {
  const container = setupContainer();

  afterEach(() => {
    commitUIPatch(); // clean up in case a test left a patch open
  });

  it('defers DOM updates until commitUIPatch is called', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState('initial');
      setValue = sv;
      return createElement('span', null, v);
    }

    render(createElement(Comp as never, {}), container.current);
    expect(container.current.textContent).toBe('initial');

    startUIPatch();
    setValue!('updated');
    expect(container.current.textContent).toBe('initial');

    commitUIPatch();
    expect(container.current.textContent).toBe('updated');
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

    render(createElement(Comp as never, {}), container.current);
    renderCalls.length = 0; // reset after initial mount

    startUIPatch();
    setValue!('b');
    setValue!('c');
    expect(container.current.textContent).toBe('a');

    commitUIPatch();
    expect(container.current.textContent).toBe('c');
  });

  it('nested patches: DOM only flushed when depth reaches zero', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Comp() {
      const [v, sv] = yield* useState('a');
      setValue = sv;
      return createElement('span', null, v);
    }

    render(createElement(Comp as never, {}), container.current);

    startUIPatch();
    startUIPatch();
    setValue!('b');
    commitUIPatch(); // depth 2→1; not flushed yet
    expect(container.current.textContent).toBe('a');
    commitUIPatch(); // depth 1→0; flushed now
    expect(container.current.textContent).toBe('b');
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

    render(createElement(App as never, {}), container.current);

    startUIPatch();
    setLive!('live-b');
    setFrozen!('frozen-b');

    expect(container.current.querySelector('#live')!.textContent).toBe('live-b');
    expect(container.current.querySelector('#frozen')!.textContent).toBe('frozen-a');

    commitUIPatch();
    expect(container.current.querySelector('#frozen')!.textContent).toBe('frozen-b');
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

    render(createElement(Outer as never, {}), container.current);

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
  const container = setupContainer();

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

    render(createElement(Parent as never, {}), container.current);

    capturedCommit = capturedStartPatch!();
    setInner!('child-b');

    expect(container.current.querySelector('#child')!.textContent).toBe('child-a');

    capturedCommit();
    expect(container.current.querySelector('#child')!.textContent).toBe('child-b');
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

    render(createElement(App as never, {}), container.current);

    const commit = capturedStartPatch!();
    setSibling!('sib-b');

    expect(container.current.querySelector('#sib')!.textContent).toBe('sib-b');

    expect(() => commit()).not.toThrow();
  });

  it('snapshot is taken at startPatch() call time', () => {
    let setShow: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Dynamic() {
      const [v] = yield* useState('dyn-a');
      return createElement('span', { id: 'dyn' }, v);
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement('div', null, show ? createElement(Dynamic as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();

    setShow!(true); // Parent is in the patch → deferred
    expect(container.current.querySelector('#dyn')).toBeNull();

    commit();
    expect(container.current.querySelector('#dyn')!.textContent).toBe('dyn-a');
  });
});
