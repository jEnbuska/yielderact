/**
 * App – top-level component rendered into `#root`.
 *
 * Provides a simple tab-based navigation between the five example demos.
 */
import { render, useState } from 'yielderact';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ThemeDemo } from './components/ThemeDemo';
import { DataFetcher, ResolveRawDemo } from './components/DataFetcher';
import { HooksShowcase } from './components/HooksShowcase';
import { ShownDemo } from './components/ShownDemo';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EffectDemo } from './components/EffectDemo';
import { TransitionDemo } from './components/TransitionDemo';

type Tab =
  | 'counter'
  | 'todos'
  | 'theme'
  | 'data'
  | 'raw'
  | 'hooks'
  | 'shown'
  | 'confirm'
  | 'effect'
  | 'transition';

const tabs: { id: Tab; label: string }[] = [
  { id: 'counter', label: 'Counter' },
  { id: 'todos', label: 'Todo List' },
  { id: 'theme', label: 'Context / Theme' },
  { id: 'data', label: 'Data Fetcher' },
  { id: 'raw', label: 'useResolveRaw' },
  { id: 'hooks', label: 'Hooks Showcase' },
  { id: 'shown', label: '$shown prop' },
  { id: 'confirm', label: 'useRender' },
  { id: 'effect', label: 'useEffect' },
  { id: 'transition', label: 'UI Patch' },
];

function* App() {
  const [activeTab, setActiveTab] = yield* useState<Tab>('counter');

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>yielderact examples</h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Generator-powered JSX components — no magic, just plain JavaScript.
      </p>

      {/* Tab bar — ids derived from data so useId() is not applicable here */}
      <nav
        role="tablist"
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'data' && <DataFetcher />}
        {activeTab === 'raw' && <ResolveRawDemo />}
        {activeTab === 'hooks' && <HooksShowcase />}
        {activeTab === 'shown' && <ShownDemo />}
        {activeTab === 'confirm' && <ConfirmDialog />}
        {activeTab === 'effect' && <EffectDemo />}
        {activeTab === 'transition' && <TransitionDemo />}
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
