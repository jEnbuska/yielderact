import { createElement } from '../../jsx';
import { render } from '../../render';
import { useState, useRender, useResume } from '../../hooks';
import { setupContainer } from '../test-utils';

describe('useRender (Variant 2 – inline function)', () => {
  const container = setupContainer();

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

    render(createElement(Comp as never, {}), container.current);

    expect(container.current.querySelector('span')?.textContent).toBe('waiting');
    expect(finalText).toBeNull();

    capturedResume!('DONE');

    expect(container.current.querySelector('p')?.textContent).toBe('DONE');
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

    render(createElement(Comp as never, {}), container.current);
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

    render(createElement(Comp as never, {}), container.current);
    expect(renderCount).toBe(1);

    setVal!(1);
    expect(renderCount).toBe(2);

    capturedResume!(true);
    expect(container.current.querySelector('div')).not.toBeNull();
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

    render(createElement(Comp as never, {}), container.current);

    capturedResume!('first');
    expect(resolveCount).toBe(1);

    setDep!(1);
    expect(container.current.querySelector('span')).not.toBeNull();

    capturedResume!('second');
    expect(resolveCount).toBe(2);
  });
});

describe('useRender (Variant 1 – JSX child with useResume)', () => {
  const container = setupContainer();

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

    render(createElement(Parent as never, {}), container.current);

    expect(container.current.querySelector('span')?.textContent).toBe('dialog');
    expect(finalAnswer).toBeNull();

    capturedResume!('ACCEPTED');

    expect(container.current.querySelector('p')?.textContent).toBe('ACCEPTED');
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

    render(createElement(Parent as never, {}), container.current);
    expect(mountCount).toBe(1);

    setVal!(1);
    expect(mountCount).toBe(1); // Dialog must NOT remount

    capturedResume!('OK');
    expect(container.current.querySelector('div')).not.toBeNull();
  });
});

describe('useResume', () => {
  const container = setupContainer();

  it('throws when called outside a useRender context', () => {
    function* Comp() {
      yield* useResume();
      return createElement('div', null);
    }

    expect(() => render(createElement(Comp as never, {}), container.current)).toThrow(
      'useResume must be called inside a component rendered by useRender',
    );
  });
});
