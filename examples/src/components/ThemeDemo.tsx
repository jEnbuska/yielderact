/**
 * ThemeDemo – demonstrates createContext / useContext with `yield* useState`.
 */
import { createContext, useContext, render, useState } from 'yielderact';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<Theme>('light');

const styles: Record<Theme, { background: string; color: string; border: string }> = {
  light: { background: '#ffffff', color: '#1a1a1a', border: '1px solid #ddd' },
  dark: { background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #444' },
};

function* ThemedCard() {
  const theme = useContext(ThemeContext);
  const s = styles[theme];
  return (
    <div
      id="themed-card"
      style={{
        padding: '1rem',
        borderRadius: '6px',
        background: s.background,
        color: s.color,
        border: s.border,
      }}
    >
      <strong>Themed Card</strong>
      <p style={{ margin: '0.4rem 0 0' }}>
        Current theme: <span id="theme-value">{theme}</span>
      </p>
    </div>
  );
}

export function* ThemeDemo() {
  const [theme, setTheme] = yield* useState<Theme>('light');

  return (
    <section aria-label="Theme context example">
      <h2>Context API</h2>
      <p>
        <code>createContext</code> / <code>useContext</code> let child components consume values
        without prop-drilling.
      </p>
      <button
        id="toggle-theme-btn"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        style={{ marginBottom: '0.75rem' }}
      >
        Toggle theme (current: {theme})
      </button>
      <ThemeContext.Provider value={theme}>
        <ThemedCard />
      </ThemeContext.Provider>
    </section>
  );
}

export function mountThemeDemo(container: HTMLElement): void {
  render(<ThemeDemo />, container);
}
