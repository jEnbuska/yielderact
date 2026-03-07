/**
 * ContextDemo – exercises multiple context permutations:
 *
 *  1. Two independent contexts (theme + locale) toggled independently.
 *  2. Nested provider override: an inner Provider shadows the outer one.
 *  3. State preservation: changing a context value must NOT reset unrelated
 *     component state in descendant components.
 *  4. Cross-subtree isolation: two sibling Providers for the same context
 *     must not interfere with each other.
 */
import { createContext, useContext, useState } from 'yielderact';

// ── Context definitions ────────────────────────────────────────────────────

type Theme = 'light' | 'dark';
type Locale = 'en' | 'fi';

const ThemeCtx = createContext<Theme>('light');
const LocaleCtx = createContext<Locale>('en');

// ── Shared style helpers ───────────────────────────────────────────────────

const themeStyles: Record<Theme, { background: string; color: string; border: string }> = {
  light: { background: '#f9f9f9', color: '#111', border: '1px solid #ccc' },
  dark: { background: '#222', color: '#eee', border: '1px solid #555' },
};

// ── Small leaf components ─────────────────────────────────────────────────

/** Reads ThemeCtx and displays the current value. */
function* ThemeBadge(props: { 'data-testid'?: string }) {
  const theme = yield* useContext(ThemeCtx);
  const s = themeStyles[theme];
  return (
    <span
      data-testid={props['data-testid'] ?? 'theme-badge'}
      style={{
        padding: '0.2rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.85rem',
        background: s.background,
        color: s.color,
        border: s.border,
      }}
    >
      {theme}
    </span>
  );
}

/** Reads LocaleCtx and displays the current value. */
function* LocaleBadge() {
  const locale = yield* useContext(LocaleCtx);
  return (
    <span data-testid="locale-badge" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}>
      {locale}
    </span>
  );
}

/** Reads both contexts — useful for verifying they change independently. */
function* BothBadge() {
  const theme = yield* useContext(ThemeCtx);
  const locale = yield* useContext(LocaleCtx);
  return (
    <span data-testid="both-badge">
      {theme}/{locale}
    </span>
  );
}

// ── Part 3 helper: consumer WITH its own state ────────────────────────────

/**
 * Reads ThemeCtx AND owns a counter.  The counter must survive a context
 * value change without being reset to 0.
 */
function* StatefulConsumer() {
  const theme = yield* useContext(ThemeCtx);
  const [count, setCount] = yield* useState(0);
  return (
    <div data-testid="stateful-consumer" style={{ display: 'flex', gap: '0.5rem' }}>
      <span data-testid="stateful-theme">{theme}</span>
      <span data-testid="stateful-count">{count}</span>
      <button data-testid="stateful-inc" onClick={() => setCount((c) => c + 1)}>
        +1
      </button>
    </div>
  );
}

// ── Part 4 helper: sibling consumers ─────────────────────────────────────

function* SiblingConsumerA() {
  const theme = yield* useContext(ThemeCtx);
  return (
    <span data-testid="sibling-a" style={{ ...themeStyles[theme] }}>
      {theme}
    </span>
  );
}

function* SiblingConsumerB() {
  const theme = yield* useContext(ThemeCtx);
  return (
    <span data-testid="sibling-b" style={{ ...themeStyles[theme] }}>
      {theme}
    </span>
  );
}

function* SiblingProvidersDemo() {
  const [valA, setValA] = yield* useState<Theme>('light');
  const [valB, setValB] = yield* useState<Theme>('dark');

  return (
    <div>
      <h3>4 · Sibling providers are isolated</h3>
      <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
        Two sibling subtrees provide different values for the same context. They must not interfere.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          data-testid="toggle-sibling-a"
          onClick={() => setValA((v) => (v === 'light' ? 'dark' : 'light'))}
        >
          Toggle A (currently: {valA})
        </button>
        <button
          data-testid="toggle-sibling-b"
          onClick={() => setValB((v) => (v === 'light' ? 'dark' : 'light'))}
        >
          Toggle B (currently: {valB})
        </button>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <ThemeCtx.Provider value={valA}>
          <div
            data-testid="sibling-panel-a"
            style={{ padding: '0.5rem', border: '1px solid #ccc' }}
          >
            Subtree A: <SiblingConsumerA />
          </div>
        </ThemeCtx.Provider>
        <ThemeCtx.Provider value={valB}>
          <div
            data-testid="sibling-panel-b"
            style={{ padding: '0.5rem', border: '1px solid #ccc' }}
          >
            Subtree B: <SiblingConsumerB />
          </div>
        </ThemeCtx.Provider>
      </div>
    </div>
  );
}

// ── Root demo component ────────────────────────────────────────────────────

export function* ContextDemo() {
  const [theme, setTheme] = yield* useState<Theme>('light');
  const [locale, setLocale] = yield* useState<Locale>('en');

  return (
    <section aria-label="Context demo">
      <h2>Context Demo</h2>

      {/* ── Controls (shared for parts 1–3) ──────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          data-testid="toggle-theme-btn"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        >
          Toggle theme
        </button>
        <button
          data-testid="toggle-locale-btn"
          onClick={() => setLocale((l) => (l === 'en' ? 'fi' : 'en'))}
        >
          Toggle locale
        </button>
      </div>

      {/* ── Part 1: two independent contexts ─────────────────────── */}
      <h3>1 · Two independent contexts</h3>
      <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
        Theme and Locale are separate contexts. Toggling one must not affect the other.
      </p>
      <ThemeCtx.Provider value={theme}>
        <LocaleCtx.Provider value={locale}>
          <div
            data-testid="independent-panel"
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              ...themeStyles[theme],
              marginBottom: '1rem',
            }}
          >
            Theme: <ThemeBadge data-testid="theme-badge" /> &nbsp; Locale: <LocaleBadge /> &nbsp;
            Both: <BothBadge />
          </div>
        </LocaleCtx.Provider>
      </ThemeCtx.Provider>

      {/* ── Part 2: inner Provider shadows outer ──────────────────── */}
      <h3>2 · Nested Provider override</h3>
      <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
        The outer theme is <em>{theme}</em>. An inner Provider hard-codes the theme to <em>dark</em>
        . The inner card must always display <em>dark</em>.
      </p>
      <ThemeCtx.Provider value={theme}>
        <div data-testid="outer-card" style={{ padding: '0.5rem', ...themeStyles[theme] }}>
          <span>Outer card – theme: </span>
          <ThemeBadge data-testid="outer-theme-badge" />
          <ThemeCtx.Provider value="dark">
            <div
              data-testid="inner-card"
              style={{ marginTop: '0.5rem', padding: '0.5rem', ...themeStyles['dark'] }}
            >
              <span>Inner card (always dark) – theme: </span>
              <ThemeBadge data-testid="inner-theme-badge" />
            </div>
          </ThemeCtx.Provider>
        </div>
      </ThemeCtx.Provider>

      {/* ── Part 3: state preserved across context updates ────────── */}
      <h3>3 · State preserved across context updates</h3>
      <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
        Increment the counter, then toggle the outer theme. The counter must keep its value.
      </p>
      <ThemeCtx.Provider value={theme}>
        <StatefulConsumer />
      </ThemeCtx.Provider>

      {/* ── Part 4: sibling providers are isolated ────────────────── */}
      <SiblingProvidersDemo />
    </section>
  );
}
