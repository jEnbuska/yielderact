import { createElement } from '../jsx';
import { render } from '../render';
import { $state, $render, $resume } from '../hooks';

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe('$render (Variant 2 – inline function)', () => {
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
      const answer = yield* $render<string>(({ resume }) => {
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
      const v = yield* $render<number>(({ resume }) => {
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
      const [, sv] = yield* $state(0);
      setVal = sv;
      yield* $render<boolean>(({ resume }) => {
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
      const [dep, sd] = yield* $state(0);
      setDep = sd;
      yield* $render<string>(
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

describe('$render (Variant 1 – JSX child with $resume)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('child component receives resume via $resume and can resolve the parent', () => {
    let capturedResume: ((v: string) => void) | null = null;
    let finalAnswer: string | null = null;

    function* Dialog() {
      const resume = yield* $resume<string>();
      capturedResume = resume;
      return createElement('span', null, 'dialog');
    }

    function* Parent() {
      const answer = yield* $render<string>(createElement(Dialog as never, {}));
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
      const resume = yield* $resume<string>();
      capturedResume = resume;
      return createElement('span', null, 'dialog');
    }

    function* Parent() {
      const [, sv] = yield* $state(0);
      setVal = sv;
      yield* $render<string>(createElement(Dialog as never, {}));
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

describe('$resume', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('throws when called outside a $render context', () => {
    function* Comp() {
      yield* $resume();
      return createElement('div', null);
    }

    expect(() => render(createElement(Comp as never, {}), container)).toThrow(
      '$resume must be called inside a component rendered by $render',
    );
  });
});
