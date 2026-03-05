import { useId, useMemo, useRef, useState } from 'yielderact';

const FRUITS = [
  'Apple',
  'Banana',
  'Cherry',
  'Date',
  'Elderberry',
  'Fig',
  'Grape',
  'Honeydew',
  'Kiwi',
  'Lemon',
  'Mango',
  'Nectarine',
];

export function* HooksShowcase() {
  const inputId = yield* useId();
  const [query, setQuery] = yield* useState('');
  const renderCount = yield* useRef(0);
  renderCount.current += 1;

  const filtered = yield* useMemo(
    (searchQuery: string) =>
      FRUITS.filter((fruit) => fruit.toLowerCase().includes(searchQuery.toLowerCase())),
    [query],
  );

  return (
    <section aria-label="Hooks showcase">
      <h2>Hooks Showcase</h2>
      <p>
        Demonstrates <code>useId</code>, <code>useMemo</code>, and <code>useRef</code> together in
        one component.
      </p>

      <div className="mb-3">
        <label htmlFor={inputId} className="mr-2">
          Search fruits:
        </label>
        <input
          id={inputId}
          data-testid="hooks-search-input"
          type="text"
          value={query}
          placeholder="Type to filter…"
          onInput={(e) => setQuery(e.currentTarget?.value ?? '')}
        />
      </div>

      <ul data-testid="hooks-fruit-list" className="list-disc pl-5 mb-2">
        {filtered.map((fruit) => (
          <li key={fruit}>{fruit}</li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p data-testid="hooks-no-results" style={{ color: '#888' }}>
          No fruits match "{query}".
        </p>
      )}

      <p data-testid="hooks-render-count" className="mt-3 text-sm" style={{ color: '#666' }}>
        Component has rendered {renderCount.current} time(s) — tracked with <code>useRef</code>{' '}
        (mutations do not cause a re-render).
      </p>
    </section>
  );
}
