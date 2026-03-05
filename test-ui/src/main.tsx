import { render, useState } from 'yielderact';
import { Counter } from './tabs/Counter';
import { TodoList } from './tabs/TodoList';
import { ThemeDemo } from './tabs/ThemeDemo';
import { DataFetcher } from './tabs/DataFetcher';
import { ResolveRawDemo } from './tabs/ResolveRawDemo';
import { HooksShowcase } from './tabs/HooksShowcase';
import { ShownDemo } from './tabs/ShownDemo';
import { ConfirmDialog } from './tabs/ConfirmDialog';
import { EffectDemo } from './tabs/EffectDemo';
import { UIPatch } from './tabs/UIPatch';

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

      <nav role="tablist" className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1.5 rounded border border-gray-300 cursor-pointer text-sm"
            style={{
              background: activeTab === tab.id ? '#0070f3' : '#fff',
              color: activeTab === tab.id ? '#fff' : '#333',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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
        {activeTab === 'transition' && <UIPatch />}
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
