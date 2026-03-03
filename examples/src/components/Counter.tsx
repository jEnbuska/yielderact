/**
 * Counter – a generator component that demonstrates local state via a plain
 * `let` variable and re-rendering via the `rerender` callback.
 */
import { render } from 'yielderact';

export function* Counter(_props: object, rerender: () => void) {
  let count = 0;
  while (true) {
    yield (
      <section aria-label="Counter example">
        <h2>Counter</h2>
        <p>
          A generator component keeps state in ordinary local variables.
          Each <code>yield</code> produces the next render.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            id="decrement-btn"
            onClick={() => {
              count--;
              rerender();
            }}
          >
            −
          </button>
          <span id="counter-value" data-testid="counter-value">
            {count}
          </span>
          <button
            id="increment-btn"
            onClick={() => {
              count++;
              rerender();
            }}
          >
            +
          </button>
          <button
            id="reset-btn"
            onClick={() => {
              count = 0;
              rerender();
            }}
            style={{ marginLeft: '0.5rem' }}
          >
            Reset
          </button>
        </div>
      </section>
    );
  }
}

export function mountCounter(container: HTMLElement): void {
  render(<Counter />, container);
}
