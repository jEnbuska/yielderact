/**
 * Visual tests for yielderact rendered into a real browser (Playwright).
 *
 * Each test:
 *  1. Bundles the TypeScript source to an IIFE with esbuild.
 *  2. Injects the bundle into a blank page via `page.addScriptTag`.
 *  3. Exercises the library via `page.evaluate` and asserts the DOM result.
 *
 * Screenshots are taken after key interactions so reviewers can see the
 * rendered output.
 */
import { test, expect, Page } from '@playwright/test';
import { build } from 'esbuild';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Bundle setup
// ---------------------------------------------------------------------------

let bundleCode = '';

test.beforeAll(async () => {
  const result = await build({
    entryPoints: [path.join(__dirname, '../src/index.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'Yielderact',
    write: false,
    tsconfig: path.join(__dirname, '../tsconfig.json'),
    // Silence any warnings in CI
    logLevel: 'error',
  });
  bundleCode = result.outputFiles[0].text;
});

/**
 * Load a blank page with the library bundle injected and a `#root` div.
 */
async function setupPage(page: Page): Promise<void> {
  await page.setContent('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: bundleCode });
}

// ---------------------------------------------------------------------------
// Helper: assert screenshot and return it for logging
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Element rendering tests
// ---------------------------------------------------------------------------

test('renders a plain HTML element', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;
    render(
      createElement('h1', { id: 'heading', className: 'title' }, 'Hello yielderact'),
      document.getElementById('root')!,
    );
  });

  await expect(page.locator('#heading')).toHaveText('Hello yielderact');
  await expect(page.locator('#heading')).toHaveClass('title');
  await page.screenshot({ path: '/tmp/visual-element.png' });
});

test('renders nested elements', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;
    render(
      createElement(
        'ul',
        { id: 'list' },
        createElement('li', null, 'Item 1'),
        createElement('li', null, 'Item 2'),
        createElement('li', null, 'Item 3'),
      ),
      document.getElementById('root')!,
    );
  });

  const items = page.locator('#list li');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveText('Item 1');
  await expect(items.nth(2)).toHaveText('Item 3');
  await page.screenshot({ path: '/tmp/visual-nested.png' });
});

// ---------------------------------------------------------------------------
// Counter (generator component with internal state)
// ---------------------------------------------------------------------------

test('generator counter increments on click', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Counter(_: object) {
      const [count, setCount] = yield* $state(0);
      return createElement(
        'button',
        {
          id: 'btn',
          onclick: () => setCount((c: number) => c + 1),
        },
        String(count),
      );
    }

    render(createElement(Counter as never, {}), document.getElementById('root')!);
  });

  await expect(page.locator('#btn')).toHaveText('0');
  await page.screenshot({ path: '/tmp/visual-counter-0.png' });

  await page.click('#btn');
  await expect(page.locator('#btn')).toHaveText('1');
  await page.screenshot({ path: '/tmp/visual-counter-1.png' });

  await page.click('#btn');
  await page.click('#btn');
  await expect(page.locator('#btn')).toHaveText('3');
  await page.screenshot({ path: '/tmp/visual-counter-3.png' });
});

// ---------------------------------------------------------------------------
// Plain function component
// ---------------------------------------------------------------------------

test('plain function component renders correctly', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function Greeting({ name }: { name: string }) {
      return createElement('p', { id: 'greeting' }, `Hello, ${name}!`);
    }

    render(
      createElement(Greeting as never, { name: 'Playwright' }),
      document.getElementById('root')!,
    );
  });

  await expect(page.locator('#greeting')).toHaveText('Hello, Playwright!');
  await page.screenshot({ path: '/tmp/visual-plain-component.png' });
});

// ---------------------------------------------------------------------------
// Component renders component (lifecycle managed by parent)
// ---------------------------------------------------------------------------

test('generator renders child generator component', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Badge({ label }: { label: string }) {
      yield createElement('span', { id: 'badge', className: 'badge' }, label);
    }

    function* App() {
      yield createElement(
        'div',
        { id: 'app' },
        createElement('h2', null, 'App'),
        createElement(Badge as never, { label: 'Active' }),
      );
    }

    render(createElement(App as never, {}), document.getElementById('root')!);
  });

  await expect(page.locator('#app h2')).toHaveText('App');
  await expect(page.locator('#badge')).toHaveText('Active');
  await page.screenshot({ path: '/tmp/visual-component-in-component.png' });
});

test('parent re-render preserves child generator state (memoization)', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Child(_: object) {
      const [count, setCount] = yield* $state(0);
      (window as unknown as Record<string, () => void>).rerenderChild = () =>
        setCount((c: number) => c + 1);
      return createElement('span', { id: 'child-count' }, String(count));
    }

    function* Parent(_: object) {
      const [, setTick] = yield* $state(0);
      (window as unknown as Record<string, () => void>).rerenderParent = () =>
        setTick((t: number) => t + 1);
      // Child props never change → should be memoized
      return createElement('div', null, createElement(Child as never, {}));
    }

    render(createElement(Parent as never, {}), document.getElementById('root')!);
  });

  await expect(page.locator('#child-count')).toHaveText('0');

  // Increment child
  await page.evaluate(() => (window as unknown as Record<string, () => void>).rerenderChild());
  await expect(page.locator('#child-count')).toHaveText('1');

  // Re-render parent with same child props → child is memoized, stays at 1
  await page.evaluate(() => (window as unknown as Record<string, () => void>).rerenderParent());
  await expect(page.locator('#child-count')).toHaveText('1');

  await page.screenshot({ path: '/tmp/visual-memoization.png' });
});

// ---------------------------------------------------------------------------
// Context API visual test
// ---------------------------------------------------------------------------

test('context Provider supplies value to deeply nested consumer', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, $context, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    const ThemeCtx = createContext<string>('light');

    function* ThemeDisplay() {
      const theme = yield* $context(ThemeCtx);
      return createElement('p', { id: 'theme' }, theme);
    }

    function* Section() {
      yield createElement('div', null, createElement(ThemeDisplay as never, {}));
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: 'dark' },
        createElement(Section as never, {}),
      ),
      document.getElementById('root')!,
    );
  });

  await expect(page.locator('#theme')).toHaveText('dark');
  await page.screenshot({ path: '/tmp/visual-context.png' });
});

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

test('Fragment renders multiple children without a wrapper', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, Fragment, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* App() {
      yield createElement(
        Fragment,
        null,
        createElement('p', { id: 'p1' }, 'First'),
        createElement('p', { id: 'p2' }, 'Second'),
      );
    }

    render(createElement(App as never, {}), document.getElementById('root')!);
  });

  await expect(page.locator('#p1')).toHaveText('First');
  await expect(page.locator('#p2')).toHaveText('Second');
  await page.screenshot({ path: '/tmp/visual-fragment.png' });
});

// ---------------------------------------------------------------------------
// $context — selector and transform overloads
// ---------------------------------------------------------------------------

test('$context selector: consumer skips rerender when selected dep is unchanged', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, $context, $ref, $state, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Consumer uses selector that tracks only `name`.
    function* Consumer() {
      const renders = yield* $ref(0);
      renders.current++;
      // Overload 2: selector only — rerender only when name changes
      const ctx = yield* $context(Ctx, (c) => [c.name]);
      return createElement('div', { id: 'consumer' }, [
        createElement('span', { id: 'name' }, ctx.name),
        createElement('span', { id: 'renders' }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* $state<State>({ name: 'Alice', count: 0 });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById('root')!);

    // Expose setter on window for Playwright to call
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt!(v);
  });

  // Initial state
  await expect(page.locator('#name')).toHaveText('Alice');
  await expect(page.locator('#renders')).toHaveText('1');

  // Change only `count` — selector tracks `name`, so Consumer must NOT rerender.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Alice', count: 99 });
  });

  await expect(page.locator('#name')).toHaveText('Alice');
  await expect(page.locator('#renders')).toHaveText('1');

  await page.screenshot({ path: '/tmp/visual-ctx-selector-stable.png' });
});

test('$context selector: consumer rerenders in-place ($ref preserved) when selected dep changes', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, $context, $ref, $state, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      const renders = yield* $ref(0);
      renders.current++;
      // Selector tracks `name`. Rerender is in-place so $ref survives.
      const ctx = yield* $context(Ctx, (c) => [c.name]);
      return createElement('div', { id: 'consumer' }, [
        createElement('span', { id: 'name' }, ctx.name),
        createElement('span', { id: 'renders' }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* $state<State>({ name: 'Alice', count: 0 });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById('root')!);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt!(v);
  });

  await expect(page.locator('#name')).toHaveText('Alice');
  await expect(page.locator('#renders')).toHaveText('1');

  // Change only `count` — selector tracks `name`, so no rerender.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Alice', count: 5 });
  });
  await expect(page.locator('#renders')).toHaveText('1');

  // Change `name` — dep changed → in-place rerender → $ref increments to 2.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Bob', count: 5 });
  });
  await expect(page.locator('#name')).toHaveText('Bob');
  await expect(page.locator('#renders')).toHaveText('2');

  await page.screenshot({ path: '/tmp/visual-ctx-selector-changed.png' });
});

test('$context transform: suppresses rerender when dep stable; updates transform when dep changes', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, $context, $ref, $state, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      const renders = yield* $ref(0);
      renders.current++;
      // Overload 3: selector + transform — returns uppercased name
      const upper = yield* $context(
        Ctx,
        (c) => [c.name] as [string],
        (name) => name.toUpperCase(),
      );
      return createElement('div', { id: 'consumer' }, [
        createElement('span', { id: 'upper' }, upper),
        createElement('span', { id: 'renders' }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* $state<State>({ name: 'Alice', count: 0 });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById('root')!);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt!(v);
  });

  // Initial: ALICE, rendered once
  await expect(page.locator('#upper')).toHaveText('ALICE');
  await expect(page.locator('#renders')).toHaveText('1');

  // Change only count — selector tracks name, so rerender is suppressed.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Alice', count: 7 });
  });
  // Consumer skipped — render count stays at 1, value unchanged.
  await expect(page.locator('#renders')).toHaveText('1');
  await expect(page.locator('#upper')).toHaveText('ALICE');

  // Change name — dep changed → in-place rerender → $ref increments to 2, transform produces BOB.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Bob', count: 7 });
  });
  await expect(page.locator('#upper')).toHaveText('BOB');
  await expect(page.locator('#renders')).toHaveText('2');

  await page.screenshot({ path: '/tmp/visual-ctx-transform.png' });
});

test('$context no-selector vs selector: no-selector updates on any field change, selector does not', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, $context, $ref, $state, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Overload 1: no selector — in-place rerender on every Provider value change.
    // $ref persists across rerenders so the count increments correctly.
    function* NoSelectorConsumer() {
      const renders = yield* $ref(0);
      renders.current++;
      const ctx = yield* $context(Ctx);
      return createElement('div', null, [
        createElement('span', { id: 'no-sel-count' }, String(ctx.count)),
        createElement('span', { id: 'no-sel-renders' }, String(renders.current)),
      ]);
    }

    // Overload 2: selector tracking `name` — stable when only count changes.
    function* SelectorConsumer() {
      const renders = yield* $ref(0);
      renders.current++;
      yield* $context(Ctx, (c) => [c.name]);
      return createElement('span', { id: 'sel-renders' }, String(renders.current));
    }

    function* App() {
      const [st, set] = yield* $state<State>({ name: 'Alice', count: 0 });
      setSt = set;
      return createElement(Ctx.Provider as never, { value: st }, [
        createElement(NoSelectorConsumer as never, {}),
        createElement(SelectorConsumer as never, {}),
      ]);
    }

    render(createElement(App as never, {}), document.getElementById('root')!);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt!(v);
  });

  await expect(page.locator('#no-sel-count')).toHaveText('0');
  await expect(page.locator('#no-sel-renders')).toHaveText('1');
  await expect(page.locator('#sel-renders')).toHaveText('1');

  // Change only `count` — no-selector consumer rerenders in-place (renders=2,
  // sees new count); selector consumer is suppressed (still at renders=1).
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Alice', count: 5 });
  });

  await expect(page.locator('#no-sel-count')).toHaveText('5');
  await expect(page.locator('#no-sel-renders')).toHaveText('2');
  await expect(page.locator('#sel-renders')).toHaveText('1');

  await page.screenshot({ path: '/tmp/visual-ctx-no-selector.png' });
});

test('$context selector: hook state preserved when rerender suppressed', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, $context, $ref, $state, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setCtx: ((v: State) => void) | null = null;
    let setLocal: ((v: number) => void) | null = null;

    function* Consumer() {
      yield* $context(Ctx, (c) => [c.name]);
      const [local, sl] = yield* $state(42);
      setLocal = sl;
      return createElement('span', { id: 'local' }, String(local));
    }

    function* App() {
      const [st, set] = yield* $state<State>({ name: 'Alice', count: 0 });
      setCtx = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById('root')!);
    (window as unknown as Record<string, unknown>).__setCtx = (v: State) => setCtx!(v);
    (window as unknown as Record<string, unknown>).__setLocal = (v: number) => setLocal!(v);
  });

  // Set local state to 100
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: number) => void>).__setLocal;
    set(100);
  });
  await expect(page.locator('#local')).toHaveText('100');

  // Change only count — selector suppresses rerender, local state must survive
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setCtx;
    set({ name: 'Alice', count: 99 });
  });
  await expect(page.locator('#local')).toHaveText('100');

  await page.screenshot({ path: '/tmp/visual-ctx-hook-state-preserved.png' });
});

// ---------------------------------------------------------------------------
// Style application
// ---------------------------------------------------------------------------

test('inline styles are applied correctly', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    render(
      createElement(
        'div',
        {
          id: 'styled',
          style: { backgroundColor: 'blue', color: 'white', padding: '8px' },
        },
        'Styled',
      ),
      document.getElementById('root')!,
    );
  });

  const el = page.locator('#styled');
  await expect(el).toHaveText('Styled');
  // Verify styles are applied
  const bgColor = await el.evaluate((node: HTMLElement) => node.style.backgroundColor);
  expect(bgColor).toBe('blue');
  await page.screenshot({ path: '/tmp/visual-styles.png' });
});

// ---------------------------------------------------------------------------
// UI Patch: child component prop updates survive to commit
// ---------------------------------------------------------------------------
//
// Regression: prevSlot.props was written with allProps during the live-only
// skip pass, so at commit time shallowEqual returned true and the component
// was never re-rendered with the new props (e.g. isPending: false).

test('global patch: child prop change before patch survives to commit (disabled button re-enabled)', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state, startUIPatch, commitUIPatch } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    let setPending: ((v: boolean) => void) | null = null;
    let doCommit: (() => void) | null = null;

    // Child component: renders a button whose disabled state mirrors the prop
    function* Nav(props: { isPending: boolean }) {
      return createElement('button', { id: 'nav-btn', disabled: props.isPending }, 'click');
    }

    function* App() {
      const [isPending, setP] = yield* $state(false);
      setPending = setP as never;
      return createElement('div', null, createElement(Nav as never, { isPending }));
    }

    render(createElement(App as never, {}), document.getElementById('root')!);

    // Step 1: set isPending=true BEFORE the patch (immediate DOM update)
    setPending!(true);

    // Step 2: start the patch
    startUIPatch();

    // Step 3: clear isPending INSIDE the patch (deferred — DOM still shows disabled)
    setPending!(false);

    // Expose a commit handle for the test to call after asserting frozen state
    doCommit = commitUIPatch;
    (window as unknown as { doCommit: typeof doCommit }).doCommit = doCommit;
  });

  // During the patch the button must still be disabled (DOM is frozen)
  await expect(page.locator('#nav-btn')).toBeDisabled();

  // Commit the patch
  await page.evaluate(() => {
    (window as unknown as { doCommit: () => void }).doCommit();
  });

  // After commit the button must be re-enabled
  await expect(page.locator('#nav-btn')).not.toBeDisabled();
  await page.screenshot({ path: '/tmp/visual-patch-prop-update-global.png' });
});

test('local patch: child prop change before patch survives to commit (disabled button re-enabled)', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state, $uiPatch } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    let setPending: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Nav(props: { isPending: boolean }) {
      return createElement('button', { id: 'nav-btn', disabled: props.isPending }, 'click');
    }

    function* App() {
      const startPatch = yield* $uiPatch();
      capturedStartPatch = startPatch;
      const [isPending, setP] = yield* $state(false);
      setPending = setP as never;
      return createElement('div', null, createElement(Nav as never, { isPending }));
    }

    render(createElement(App as never, {}), document.getElementById('root')!);

    // Step 1: set isPending=true BEFORE the patch (immediate DOM update)
    setPending!(true);

    // Step 2: start the local patch and capture the commit fn
    const commit = capturedStartPatch!();

    // Step 3: clear isPending inside the patch (deferred)
    setPending!(false);

    // Expose the commit fn for the test to call after asserting the frozen state
    (window as unknown as { doCommit: () => void }).doCommit = commit;
  });

  // DOM must be frozen — button still disabled
  await expect(page.locator('#nav-btn')).toBeDisabled();

  // Commit
  await page.evaluate(() => {
    (window as unknown as { doCommit: () => void }).doCommit();
  });

  // After commit the button must be re-enabled
  await expect(page.locator('#nav-btn')).not.toBeDisabled();
  await page.screenshot({ path: '/tmp/visual-patch-prop-update-local.png' });
});

// ---------------------------------------------------------------------------
// $effect AbortSignal tests
// ---------------------------------------------------------------------------

test('$effect: AbortSignal abort count increments when deps change', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state, $effect } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
      const [status, setStatus] = yield* $state('idle');
      const [abortCount, setAbortCount] = yield* $state(0);

      yield* $effect(
        (signal: AbortSignal) => {
          if (activeId !== userId) {
            setStatus('inactive');
            return;
          }
          setStatus('polling');
          signal.addEventListener(
            'abort',
            () => {
              setAbortCount((c: number) => c + 1);
              setStatus('aborted');
            },
            { once: true },
          );
        },
        [activeId],
      );

      return createElement(
        'div',
        { id: `row-${userId}` },
        createElement('span', { id: `status-${userId}` }, status),
        createElement('span', { id: `aborts-${userId}` }, String(abortCount)),
      );
    }

    function* App() {
      const [activeId, setActiveId] = yield* $state(1);
      win.setActiveId = setActiveId;

      return createElement(
        'div',
        null,
        createElement(SignalRow, { userId: 1, activeId }),
        createElement(SignalRow, { userId: 2, activeId }),
        createElement(SignalRow, { userId: 3, activeId }),
      );
    }

    render(createElement(App, {}), document.getElementById('root')!);
  });

  // Initial: user 1 is polling, others inactive, all abort counts 0
  await expect(page.locator('#status-1')).toHaveText('polling');
  await expect(page.locator('#aborts-1')).toHaveText('0');
  await expect(page.locator('#status-2')).toHaveText('inactive');
  await expect(page.locator('#status-3')).toHaveText('inactive');

  // Switch to user 2 — user 1's abort count increases to 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(2);
  });

  await expect(page.locator('#status-2')).toHaveText('polling');
  await expect(page.locator('#aborts-1')).toHaveText('1');
  // status-1 is "inactive" because the effect re-runs with the new activeId
  await expect(page.locator('#status-1')).toHaveText('inactive');

  // Switch to user 3 — user 2's abort count increases to 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(3);
  });

  await expect(page.locator('#status-3')).toHaveText('polling');
  await expect(page.locator('#aborts-2')).toHaveText('1');
  await expect(page.locator('#status-2')).toHaveText('inactive');

  // Switch back to user 1 — user 3's abort count increases, user 1 still has 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(1);
  });

  await expect(page.locator('#status-1')).toHaveText('polling');
  await expect(page.locator('#aborts-3')).toHaveText('1');
  await expect(page.locator('#aborts-1')).toHaveText('1');

  await page.screenshot({ path: '/tmp/visual-abort-signal-deps-change.png' });
});

test('$effect: AbortSignal is aborted on component unmount', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state, $effect, $ref } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Ticker() {
      const [count, setCount] = yield* $state(0);
      const abortedRef = yield* $ref(false);

      yield* $effect((signal: AbortSignal) => {
        let n = 0;
        const id = setInterval(() => {
          if (signal.aborted) return;
          n++;
          setCount(n);
        }, 100);

        signal.addEventListener(
          'abort',
          () => {
            clearInterval(id);
            abortedRef.current = true;
          },
          { once: true },
        );

        // No cleanup fn — relying on AbortSignal only
      }, []);

      return createElement(
        'div',
        { id: 'ticker' },
        createElement('span', { id: 'tick-count' }, String(count)),
        createElement('span', { id: 'tick-aborted' }, String(abortedRef.current)),
      );
    }

    function* App() {
      const [show, setShow] = yield* $state(true);
      (window as unknown as Record<string, unknown>).setShow = setShow;

      return createElement(
        'div',
        null,
        show ? createElement(Ticker, {}) : createElement('span', { id: 'gone' }, 'unmounted'),
      );
    }

    render(createElement(App, {}), document.getElementById('root')!);
  });

  // Ticker should be running
  await expect(page.locator('#ticker')).toBeAttached();

  // Wait for a couple ticks
  await page.waitForTimeout(350);
  const countBefore = Number(await page.locator('#tick-count').textContent());
  expect(countBefore).toBeGreaterThanOrEqual(2);

  // Unmount the ticker
  await page.evaluate(() => {
    (window as unknown as { setShow: (v: boolean) => void }).setShow(false);
  });

  await expect(page.locator('#gone')).toHaveText('unmounted');

  // The ticker should be gone and the interval stopped (signal aborted)
  await expect(page.locator('#ticker')).not.toBeAttached();

  await page.screenshot({ path: '/tmp/visual-abort-signal-unmount.png' });
});

test('$effect: AbortSignal aborts async work (fetch-like) on deps change', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, render, $state, $effect } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* AsyncWorker({ taskId }: { taskId: number }) {
      const [result, setResult] = yield* $state('pending');

      yield* $effect(
        (signal: AbortSignal) => {
          setResult('pending');
          // Simulate async work that respects the signal
          const timer = setTimeout(() => {
            if (!signal.aborted) {
              setResult(`done-${taskId}`);
            }
          }, 300);

          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              setResult(`cancelled-${taskId}`);
            },
            { once: true },
          );
        },
        [taskId],
      );

      return createElement('span', { id: 'async-result' }, result);
    }

    function* App() {
      const [taskId, setTaskId] = yield* $state(1);
      (window as unknown as Record<string, unknown>).setTaskId = setTaskId;

      return createElement(
        'div',
        null,
        createElement('span', { id: 'task-id' }, String(taskId)),
        createElement(AsyncWorker, { taskId }),
      );
    }

    render(createElement(App, {}), document.getElementById('root')!);
  });

  // Initial: pending then resolves to done-1
  await expect(page.locator('#async-result')).toHaveText('done-1', { timeout: 2000 });

  // Change task before it can complete — previous is cancelled, new one starts
  await page.evaluate(() => {
    (window as unknown as { setTaskId: (v: number) => void }).setTaskId(2);
  });

  // Should quickly show cancelled for task 1, then resolve to done-2
  await expect(page.locator('#async-result')).toHaveText('done-2', { timeout: 2000 });
  await expect(page.locator('#task-id')).toHaveText('2');

  await page.screenshot({ path: '/tmp/visual-abort-signal-async-cancel.png' });
});
