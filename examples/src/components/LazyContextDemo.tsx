/**
 * LazyContextDemo – demonstrates all three useContext overloads:
 *
 *   1. No selector   — rerenders whenever the Provider value changes.
 *   2. Selector only — rerenders only when the selected deps change; returns full value.
 *   3. Selector + transform — same rerender guard; returns the transformed value.
 *
 * Each consumer displays a render counter so you can verify in the UI (and in
 * Playwright tests) that consumers 2 and 3 do NOT rerender when only an
 * unsubscribed field changes.
 */
import { createContext, useContext, useState, useRef } from 'yielderact';

// ---------------------------------------------------------------------------
// Context shape & context object
// ---------------------------------------------------------------------------

type AppState = {
  user: { name: string; role: string };
  count: number;
};

const AppCtx = createContext<AppState>({
  user: { name: 'Alice', role: 'admin' },
  count: 0,
});

// ---------------------------------------------------------------------------
// Helper: a small badge that shows how many times a component has rendered
// ---------------------------------------------------------------------------

function RenderBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '9999px',
        background: '#0070f3',
        color: '#fff',
        fontSize: '0.75rem',
        marginLeft: '0.4rem',
      }}
    >
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Consumer 1 — no selector (always rerenders on Provider value change)
// ---------------------------------------------------------------------------

function* NoSelectorConsumer() {
  const renderCount = yield* useRef(0);
  renderCount.current++;

  // Overload 1: plain useContext — reads the full value every time
  const ctx = yield* useContext(AppCtx);

  return (
    <div
      data-testid="lazy-ctx-no-selector"
      style={{ padding: '0.5rem', background: '#f9f9f9', borderRadius: '4px' }}
    >
      <strong>
        Overload 1 — no selector
        <RenderBadge count={renderCount.current} />
      </strong>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
        name: <code data-testid="lazy-ctx-no-selector-name">{ctx.user.name}</code>
        {'  '}count: <code data-testid="lazy-ctx-no-selector-count-val">{ctx.count}</code>
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#666' }}>
        Render count: <span data-testid="lazy-ctx-no-selector-renders">{renderCount.current}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consumer 2 — selector only (rerenders only when user.name changes)
// ---------------------------------------------------------------------------

function* SelectorConsumer() {
  const renderCount = yield* useRef(0);
  renderCount.current++;

  // Overload 2: selector — only rerender when user.name changes; still returns full ctx
  const ctx = yield* useContext(AppCtx, (c) => [c.user.name]);

  return (
    <div
      data-testid="lazy-ctx-selector"
      style={{ padding: '0.5rem', background: '#f0f7ff', borderRadius: '4px' }}
    >
      <strong>
        Overload 2 — selector (tracks user.name)
        <RenderBadge count={renderCount.current} />
      </strong>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
        name: <code data-testid="lazy-ctx-selector-name">{ctx.user.name}</code>
        {'  '}count: <code data-testid="lazy-ctx-selector-count-val">{ctx.count}</code>
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#666' }}>
        Render count: <span data-testid="lazy-ctx-selector-renders">{renderCount.current}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consumer 3 — selector + transform (only rerenders when user.name changes;
//               returns the uppercased name directly instead of full ctx)
// ---------------------------------------------------------------------------

function* TransformConsumer() {
  const renderCount = yield* useRef(0);
  renderCount.current++;

  // Overload 3: selector + transform — returns transformed slice, skips rerender
  // when user.name is unchanged.
  const upperName = yield* useContext(
    AppCtx,
    (c) => [c.user.name] as [string],
    (name) => name.toUpperCase(),
  );

  return (
    <div
      data-testid="lazy-ctx-transform"
      style={{ padding: '0.5rem', background: '#f0fff4', borderRadius: '4px' }}
    >
      <strong>
        Overload 3 — selector + transform (tracks user.name, returns uppercased)
        <RenderBadge count={renderCount.current} />
      </strong>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
        UPPER_NAME: <code data-testid="lazy-ctx-transform-value">{upperName}</code>
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#666' }}>
        Render count: <span data-testid="lazy-ctx-transform-renders">{renderCount.current}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root demo component
// ---------------------------------------------------------------------------

export function* LazyContextDemo() {
  const [state, setState] = yield* useState<AppState>({
    user: { name: 'Alice', role: 'admin' },
    count: 0,
  });

  return (
    <section aria-label="Lazy context demo" data-testid="lazy-ctx-demo">
      <h2>Lazy useContext (selector &amp; transform)</h2>
      <p style={{ fontSize: '0.875rem', color: '#555', marginBottom: '0.75rem' }}>
        The <strong>render count badge</strong> on each consumer shows how many times it has
        rendered. Use the buttons to change only <code>count</code> or only <code>user.name</code>{' '}
        and observe which consumers rerender.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          data-testid="lazy-ctx-bump-count"
          onClick={() =>
            setState({
              ...state,
              count: state.count + 1,
            })
          }
          style={{ padding: '0.4rem 0.8rem' }}
        >
          Bump count (+1)
        </button>

        <button
          data-testid="lazy-ctx-change-name"
          onClick={() =>
            setState({
              ...state,
              user: {
                ...state.user,
                name: state.user.name === 'Alice' ? 'Bob' : 'Alice',
              },
            })
          }
          style={{ padding: '0.4rem 0.8rem' }}
        >
          Toggle name (Alice ↔ Bob)
        </button>

        <button
          data-testid="lazy-ctx-change-role"
          onClick={() =>
            setState({
              ...state,
              user: {
                ...state.user,
                role: state.user.role === 'admin' ? 'viewer' : 'admin',
              },
            })
          }
          style={{ padding: '0.4rem 0.8rem' }}
        >
          Toggle role (admin ↔ viewer)
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
        Current state — name: <strong>{state.user.name}</strong> | role:{' '}
        <strong>{state.user.role}</strong> | count: <strong>{state.count}</strong>
      </p>

      <AppCtx.Provider value={state}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <NoSelectorConsumer />
          <SelectorConsumer />
          <TransformConsumer />
        </div>
      </AppCtx.Provider>

      <details style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#555' }}>
        <summary>Expected behavior</summary>
        <ul>
          <li>
            <strong>Bump count</strong> → only overload 1 rerenders (selector consumers skip).
          </li>
          <li>
            <strong>Toggle role</strong> → only overload 1 rerenders (selector consumers skip).
          </li>
          <li>
            <strong>Toggle name</strong> → all three rerender (name is in each selector).
          </li>
        </ul>
      </details>
    </section>
  );
}
