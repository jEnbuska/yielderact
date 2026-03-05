import { createElement } from '../../jsx';
import { render } from '../../render';
import { useState, useResolve, useResolveRaw, useMemo } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('render – generator components with useResolve', () => {
  const container = setupContainer();

  it('shows loading state while promise is pending', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });

    function* DataComp() {
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', { id: 'error' }, 'Error'),
        },
        [],
      );
      return createElement('span', { id: 'data' }, data);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();
    expect(container.current.querySelector('#data')).toBeNull();

    resolvePromise('Hello World');
    await promise;

    expect(container.current.querySelector('#loading')).toBeNull();
    expect(container.current.querySelector('#data')).not.toBeNull();
    expect(container.current.querySelector('#data')!.textContent).toBe('Hello World');
  });

  it('shows error state when promise rejects', async () => {
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<string>((_res, rej) => {
      rejectPromise = rej;
    });

    function* DataComp() {
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', { id: 'error' }, 'Error'),
        },
        [],
      );
      return createElement('span', { id: 'data' }, data);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    rejectPromise(new Error('network error'));
    await promise.catch(() => {});

    expect(container.current.querySelector('#error')).not.toBeNull();
    expect(container.current.querySelector('#data')).toBeNull();
  });

  it('useResolve can coexist with useState in the same component', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });
    let setLabel: ((v: string) => void) | null = null;

    function* DataComp() {
      const [label, sl] = yield* useState('prefix');
      setLabel = sl;
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', null, 'Error'),
        },
        [],
      );
      return createElement('p', { id: 'result' }, `${label}:${data}`);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolvePromise('world');
    await promise;

    expect(container.current.querySelector('#result')!.textContent).toBe('prefix:world');

    setLabel!('updated');
    expect(container.current.querySelector('#result')!.textContent).toBe('updated:world');
  });

  it('useState change while promise is pending triggers fresh run and shows correct state after resolve', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });
    let setLabel: ((v: string) => void) | null = null;

    function* DataComp() {
      const [label, sl] = yield* useState('prefix');
      setLabel = sl;
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', null, 'Error'),
        },
        [],
      );
      return createElement('p', { id: 'result' }, `${label}:${data}`);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    setLabel!('updated');
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolvePromise('world');
    await promise;

    expect(container.current.querySelector('#result')!.textContent).toBe('updated:world');
  });

  it('useResolve re-runs when deps change', async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });

    let setId: ((v: number) => void) | null = null;
    let fetchCount = 0;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const data = yield* useResolve(
        {
          fn: (_signal) => {
            fetchCount++;
            return id === 1 ? firstPromise : secondPromise;
          },
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', null, 'Error'),
        },
        [id],
      );
      return createElement('p', { id: 'result' }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(fetchCount).toBe(1);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolveFirst('user1');
    await firstPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('1:user1');

    setId!(2);
    expect(fetchCount).toBe(2);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolveSecond('user2');
    await secondPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('2:user2');
  });

  it('stale promise result is ignored when deps change before it resolves', async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });

    let setId: ((v: number) => void) | null = null;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const data = yield* useResolve(
        {
          fn: (_signal) => (id === 1 ? firstPromise : secondPromise),
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', null, 'Error'),
        },
        [id],
      );
      return createElement('p', { id: 'result' }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    setId!(2);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolveSecond('user2');
    await secondPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('2:user2');

    resolveFirst('user1');
    await firstPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('2:user2');
  });

  it('aborts the previous AbortSignal when deps change', async () => {
    const abortedSignals: AbortSignal[] = [];
    let setId: ((v: number) => void) | null = null;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      yield* useResolve(
        {
          fn: (signal) => {
            signal.addEventListener('abort', () => abortedSignals.push(signal));
            return new Promise(() => {}); // never resolves
          },
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', null, 'Error'),
        },
        [id],
      );
      return createElement('span', {}, 'done');
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(abortedSignals).toHaveLength(0);

    setId!(2);
    expect(abortedSignals).toHaveLength(1);
    expect(abortedSignals[0].aborted).toBe(true);
  });

  it('aborts the AbortSignal when the component unmounts', async () => {
    let capturedSignal: AbortSignal | null = null;
    let setShow: ((v: boolean) => void) | null = null;

    function* Inner() {
      yield* useResolve(
        {
          fn: (signal) => {
            capturedSignal = signal;
            return new Promise(() => {}); // never resolves
          },
          loading: createElement('span', { id: 'loading' }, 'Loading…'),
          error: createElement('span', null, 'Error'),
        },
        [],
      );
      return createElement('span', {}, 'done');
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show ? createElement(Inner as never, {}) : null;
    }

    render(createElement(Outer as never, {}), container.current);
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    setShow!(false);
    expect(capturedSignal!.aborted).toBe(true);
  });
});

describe('render – generator components with useResolveRaw', () => {
  const container = setupContainer();

  it('renders loading state while promise is pending', async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });

    function* DataComp() {
      const p = yield* useMemo(() => promise, []);
      const { data, loading } = yield* useResolveRaw<string>(p);
      if (loading) return createElement('span', { id: 'loading' }, 'Loading…');
      return createElement('span', { id: 'data' }, data);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();
    expect(container.current.querySelector('#data')).toBeNull();

    resolvePromise('Hello');
    await promise;

    expect(container.current.querySelector('#loading')).toBeNull();
    expect(container.current.querySelector('#data')).not.toBeNull();
    expect(container.current.querySelector('#data')!.textContent).toBe('Hello');
  });

  it('renders error state when promise rejects', async () => {
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<string>((_res, rej) => {
      rejectPromise = rej;
    });

    function* DataComp() {
      const p = yield* useMemo(() => promise, []);
      const { data, loading, error } = yield* useResolveRaw<string, Error>(p);
      if (loading) return createElement('span', { id: 'loading' }, 'Loading…');
      if (error) return createElement('span', { id: 'error' }, error.message);
      return createElement('span', { id: 'data' }, data);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    rejectPromise(new Error('network error'));
    await promise.catch(() => {});

    expect(container.current.querySelector('#error')).not.toBeNull();
    expect(container.current.querySelector('#error')!.textContent).toBe('network error');
    expect(container.current.querySelector('#data')).toBeNull();
  });

  it('re-fetches when the promise reference changes', async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });
    let setId: ((v: number) => void) | null = null;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const p = yield* useMemo(() => (id === 1 ? firstPromise : secondPromise), [id]);
      const { data, loading } = yield* useResolveRaw<string>(p);
      if (loading) return createElement('span', { id: 'loading' }, 'Loading…');
      return createElement('p', { id: 'result' }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container.current);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolveFirst('user1');
    await firstPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('1:user1');

    setId!(2);
    expect(container.current.querySelector('#loading')).not.toBeNull();

    resolveSecond('user2');
    await secondPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('2:user2');
  });

  it('ignores stale promise result when promise reference changes', async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });
    let setId: ((v: number) => void) | null = null;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const p = yield* useMemo(() => (id === 1 ? firstPromise : secondPromise), [id]);
      const { data, loading } = yield* useResolveRaw<string>(p);
      if (loading) return createElement('span', { id: 'loading' }, 'Loading…');
      return createElement('p', { id: 'result' }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container.current);

    setId!(2);

    resolveSecond('user2');
    await secondPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('2:user2');

    resolveFirst('user1');
    await firstPromise;
    expect(container.current.querySelector('#result')!.textContent).toBe('2:user2');
  });
});
