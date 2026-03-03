/**
 * Counter – a generator component demonstrating stateful rendering with
 * `yield* useState` and returning JSX.
 */
import { render, useState } from 'yielderact';

export function* Counter() {
  const [count, setCount] = yield* useState(0);

  return (
    <section aria-label="Counter example">
      <h2>Counter</h2>
      <p>
        A generator component keeps state via <code>yield* useState</code>.
        Each call to the setter re-runs the component body and reconciles the DOM.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          id="decrement-btn"
          onClick={() => setCount(count - 1)}
        >
          −
        </button>
        <span id="counter-value" data-testid="counter-value">
          {count}
        </span>
        <button
          id="increment-btn"
          onClick={() => setCount(count + 1)}
        >
          +
        </button>
        <button
          id="reset-btn"
          onClick={() => setCount(0)}
          style={{ marginLeft: '0.5rem' }}
        >
          Reset
        </button>
      </div>
    </section>
  );
}

export function mountCounter(container: HTMLElement): void {
  render(<Counter />, container);
}
