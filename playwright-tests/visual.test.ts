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
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    function* Counter(_: object, rerender: () => void) {
      let count = 0;
      while (true) {
        yield createElement(
          'button',
          {
            id: 'btn',
            onclick: () => {
              count++;
              rerender();
            },
          },
          String(count),
        );
      }
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
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import('../src/index') }
    ).Yielderact;

    // Expose rerenders to the window for test control
    (window as unknown as Record<string, () => void>).rerenderParent = () => {};
    (window as unknown as Record<string, () => void>).rerenderChild = () => {};

    function* Child(_: object, rerender: () => void) {
      (window as unknown as Record<string, () => void>).rerenderChild = rerender;
      let count = 0;
      while (true) {
        yield createElement('span', { id: 'child-count' }, String(count));
        count++;
      }
    }

    function* Parent(_: object, rerender: () => void) {
      (window as unknown as Record<string, () => void>).rerenderParent = rerender;
      while (true) {
        // Child props never change → should be memoized
        yield createElement('div', null, createElement(Child as never, {}));
      }
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
      const theme = useContext(ThemeCtx);
      yield createElement('p', { id: 'theme' }, theme);
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
