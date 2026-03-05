import { createContext, useContext, useState, useId } from 'yielderact';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<Theme>('light');

const themeStyles: Record<Theme, { background: string; color: string; border: string }> = {
  light: { background: '#ffffff', color: '#1a1a1a', border: '1px solid #ddd' },
  dark: { background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #444' },
};

function* ThemedCard() {
  const cardId = yield* useId();
  const themeValueId = yield* useId();
  const theme = yield* useContext(ThemeContext);
  const s = themeStyles[theme];
  return (
    <div
      id={cardId}
      data-testid="themed-card"
      className="p-4 rounded-md"
      style={{ background: s.background, color: s.color, border: s.border }}
    >
      <strong>Themed Card</strong>
      <p className="mt-1">
        Current theme:{' '}
        <span id={themeValueId} data-testid="theme-value">
          {theme}
        </span>
      </p>
    </div>
  );
}

export function* ThemeDemo() {
  const toggleBtnId = yield* useId();
  const [theme, setTheme] = yield* useState<Theme>('light');

  return (
    <section aria-label="Theme context example">
      <h2>Context API</h2>
      <p>
        <code>createContext</code> / <code>useContext</code> let child components consume values
        without prop-drilling.
      </p>
      <button
        id={toggleBtnId}
        data-testid="toggle-theme-btn"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="mb-3"
      >
        Toggle theme (current: {theme})
      </button>
      <ThemeContext.Provider value={theme}>
        <ThemedCard />
      </ThemeContext.Provider>
    </section>
  );
}
