/**
 * App – top-level component rendered into `#root`.
 *
 * Provides a simple tab-based navigation between the three example demos.
 */
import { render } from 'yielderact';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ThemeDemo } from './components/ThemeDemo';

type Tab = 'counter' | 'todos' | 'theme';

const tabs: { id: Tab; label: string }[] = [
  { id: 'counter', label: 'Counter' },
  { id: 'todos', label: 'Todo List' },
  { id: 'theme', label: 'Context / Theme' },
];

function* App(_props: object, rerender: () => void) {
  let activeTab: Tab = 'counter';

  while (true) {
    yield (
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>yielderact examples</h1>
        <p style={{ color: '#555', marginBottom: '1.25rem' }}>
          Generator-powered JSX components — no magic, just plain JavaScript.
        </p>

        {/* Tab bar */}
        <nav
          role="tablist"
          style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              onClick={() => {
                activeTab = tab.id;
                rerender();
              }}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: activeTab === tab.id ? '#0070f3' : '#fff',
                color: activeTab === tab.id ? '#fff' : '#333',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Active panel */}
        <div id="example-panel">
          {activeTab === 'counter' && <Counter />}
          {activeTab === 'todos' && <TodoList />}
          {activeTab === 'theme' && <ThemeDemo />}
        </div>
      </div>
    );
  }
}

render(<App />, document.getElementById('root')!);
