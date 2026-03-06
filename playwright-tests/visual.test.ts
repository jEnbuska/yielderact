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
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Counter(_: object) {
      const [count, setCount] = yield* useState(0);
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
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Child(_: object) {
      const [count, setCount] = yield* useState(0);
      (window as unknown as Record<string, () => void>).rerenderChild = () =>
        setCount((c: number) => c + 1);
      return createElement('span', { id: 'child-count' }, String(count));
    }

    function* Parent(_: object) {
      const [, setTick] = yield* useState(0);
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
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    const ThemeCtx = createContext<string>('light');

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
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
// useContext — selector and transform overloads
// ---------------------------------------------------------------------------

test('useContext selector: consumer skips rerender when selected dep is unchanged', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Consumer uses selector that tracks only `name`.
    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      // Overload 2: selector only — rerender only when name changes
      const ctx = yield* useContext(Ctx, (c) => [c.name]);
      return createElement('div', { id: 'consumer' }, [
        createElement('span', { id: 'name' }, ctx.name),
        createElement('span', { id: 'renders' }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: 'Alice', count: 0 });
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

test('useContext selector: consumer updates when selected dep changes', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      // Selector tracks `name`. When name changes the subtree is remounted so
      // the new value is reflected in the DOM.
      const ctx = yield* useContext(Ctx, (c) => [c.name]);
      return createElement('span', { id: 'name' }, ctx.name);
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: 'Alice', count: 0 });
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

  // Change `name` — Consumer's selected dep changed so the subtree updates.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Bob', count: 0 });
  });

  await expect(page.locator('#name')).toHaveText('Bob');

  await page.screenshot({ path: '/tmp/visual-ctx-selector-changed.png' });
});

test('useContext transform: suppresses rerender when dep stable; updates transform when dep changes', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      // Overload 3: selector + transform — returns uppercased name
      const upper = yield* useContext(
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
      const [st, set] = yield* useState<State>({ name: 'Alice', count: 0 });
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

  // Change name — dep changed, subtree updates, transform produces BOB.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Bob', count: 7 });
  });
  await expect(page.locator('#upper')).toHaveText('BOB');

  await page.screenshot({ path: '/tmp/visual-ctx-transform.png' });
});

test('useContext no-selector vs selector: no-selector updates on any field change, selector does not', async ({
  page,
}) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Overload 1: no selector — local useState tracks renders across same instance.
    // NOTE: when Provider value changes with no-selector, the subtree is remounted,
    // so we track the update by observing the displayed count field instead.
    function* NoSelectorConsumer() {
      const ctx = yield* useContext(Ctx);
      return createElement('span', { id: 'no-sel-count' }, String(ctx.count));
    }

    // Overload 2: selector tracking `name` — stable when only count changes.
    function* SelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      yield* useContext(Ctx, (c) => [c.name]);
      return createElement('span', { id: 'sel-renders' }, String(renders.current));
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: 'Alice', count: 0 });
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
  await expect(page.locator('#sel-renders')).toHaveText('1');

  // Change only `count` — no-selector consumer sees the new value;
  // selector consumer is suppressed (still at renders=1).
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: 'Alice', count: 5 });
  });

  await expect(page.locator('#no-sel-count')).toHaveText('5');
  await expect(page.locator('#sel-renders')).toHaveText('1');

  await page.screenshot({ path: '/tmp/visual-ctx-no-selector.png' });
});

test('useContext selector: hook state preserved when rerender suppressed', async ({ page }) => {
  await setupPage(page);

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: 'Alice', count: 0 });

    let setCtx: ((v: State) => void) | null = null;
    let setLocal: ((v: number) => void) | null = null;

    function* Consumer() {
      yield* useContext(Ctx, (c) => [c.name]);
      const [local, sl] = yield* useState(42);
      setLocal = sl;
      return createElement('span', { id: 'local' }, String(local));
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: 'Alice', count: 0 });
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
