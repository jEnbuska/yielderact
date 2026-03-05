import { createElement } from '../../jsx';
import { render, startUIPatch, commitUIPatch } from '../../render';
import { useState, useUIPatch } from '../../hooks';
import { setupContainer } from '../test-utils';

// ---------------------------------------------------------------------------
// Live-only reconcile: element add/remove during global patch
// ---------------------------------------------------------------------------

describe('live-only reconcile: element add/remove during global patch', () => {
  const container = setupContainer();

  afterEach(() => {
    commitUIPatch(); // clean up in case a test left a patch open
  });

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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')).not.toBeNull();

    startUIPatch();
    setShow!(false);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')).not.toBeNull();

    startUIPatch();
    setShow!(false);
    expect(container.current.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setShow!(false);
    expect(container.current.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')).not.toBeNull();

    startUIPatch();
    setShow!(false);
    expect(container.current.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setShow!(false);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).toBeNull();
  });

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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')).toBeNull();

    startUIPatch();
    setShow!(true);
    expect(container.current.querySelector('#target')).toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setShow!(true);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setShow!(true);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')).toBeNull();

    startUIPatch();
    setShow!(true);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).not.toBeNull();
  });

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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setShow!(false); // remove — frozen, stays visible
    expect(container.current.querySelector('#target')).not.toBeNull();
    setShow!(true); // re-add — still frozen
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setShow!(false); // live remove → gone immediately
    expect(container.current.querySelector('#target')).toBeNull();
    setShow!(true); // live re-add → back immediately
    expect(container.current.querySelector('#target')).not.toBeNull();

    commitUIPatch();
    expect(container.current.querySelector('#target')).not.toBeNull();
  });

  it('text inside $patch="live" wrapper updates immediately', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Parent() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('div', { $patch: 'live' }, v);
    }

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setValue!('b');
    expect(container.current.textContent).toBe('b');

    commitUIPatch();
    expect(container.current.textContent).toBe('b');
  });

  it('text outside live context stays frozen until commit', () => {
    let setValue: ((v: string) => void) | null = null;

    function* Parent() {
      const [v, setV] = yield* useState('a');
      setValue = setV;
      return createElement('span', null, v);
    }

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setValue!('b');
    expect(container.current.textContent).toBe('a');

    commitUIPatch();
    expect(container.current.textContent).toBe('b');
  });

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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')!.textContent).toBe('a');

    startUIPatch();
    setValue!('b');
    expect(container.current.querySelector('#target')!.textContent).toBe('a');

    setLive!(true);
    setValue!('c');
    expect(container.current.querySelector('#target')!.textContent).toBe('c');

    commitUIPatch();
    expect(container.current.querySelector('#target')!.textContent).toBe('c');
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setValue!('b');
    expect(container.current.querySelector('#target')!.textContent).toBe('b');

    setLive!(false);
    setValue!('c');
    expect(container.current.querySelector('#target')!.textContent).toBe('b');

    commitUIPatch();
    expect(container.current.querySelector('#target')!.textContent).toBe('c');
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

    render(createElement(Parent as never, {}), container.current);

    startUIPatch();
    setValue!('b'); // live → updates immediately
    expect(container.current.querySelector('#target')!.textContent).toBe('b');

    setLive!(false); // switch to default — 'b' stays in DOM
    expect(container.current.querySelector('#target')!.textContent).toBe('b');

    commitUIPatch();
    expect(container.current.querySelector('#target')!.textContent).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Live-only reconcile: element add/remove during local patch
// ---------------------------------------------------------------------------

describe('live-only reconcile: element add/remove during local patch', () => {
  const container = setupContainer();

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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(false);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commit();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(false);
    expect(container.current.querySelector('#target')).toBeNull();

    commit();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(true);
    expect(container.current.querySelector('#target')).toBeNull();

    commit();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(true);
    expect(container.current.querySelector('#target')).not.toBeNull();

    commit();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(true); // live-add → appears immediately
    expect(container.current.querySelector('#target')).not.toBeNull();
    setShow!(false); // live-remove → disappears immediately
    expect(container.current.querySelector('#target')).toBeNull();

    commit();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(true); // default: still not visible
    expect(container.current.querySelector('#target')).toBeNull();
    setShow!(false); // default: still not visible
    expect(container.current.querySelector('#target')).toBeNull();

    commit();
    expect(container.current.querySelector('#target')).toBeNull();
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

    render(createElement(Parent as never, {}), container.current);

    const commit = capturedStartPatch!();
    setShow!(false); // frozen: still visible
    expect(container.current.querySelector('#target')).not.toBeNull();
    setShow!(true); // frozen: still visible
    expect(container.current.querySelector('#target')).not.toBeNull();

    commit();
    expect(container.current.querySelector('#target')).not.toBeNull();
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

    render(createElement(Parent as never, {}), container.current);
    expect(container.current.querySelector('#target')).not.toBeNull();

    const commit = capturedStartPatch!();
    setShown!(false); // live → hides immediately
    expect(container.current.querySelector('#target')).toBeNull();

    commit();
    expect(container.current.querySelector('#target')).toBeNull();
  });
});
