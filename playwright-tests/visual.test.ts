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
    const { createElement, render, useState, startUIPatch, commitUIPatch } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    let setPending: ((v: boolean) => void) | null = null;
    let doCommit: (() => void) | null = null;

    // Child component: renders a button whose disabled state mirrors the prop
    function* Nav(props: { isPending: boolean }) {
      return createElement('button', { id: 'nav-btn', disabled: props.isPending }, 'click');
    }

    function* App() {
      const [isPending, setP] = yield* useState(false);
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
    const { createElement, render, useState, useUIPatch } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    let setPending: ((v: boolean) => void) | null = null;
    let capturedStartPatch: (() => () => void) | null = null;

    function* Nav(props: { isPending: boolean }) {
      return createElement('button', { id: 'nav-btn', disabled: props.isPending }, 'click');
    }

    function* App() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [isPending, setP] = yield* useState(false);
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
