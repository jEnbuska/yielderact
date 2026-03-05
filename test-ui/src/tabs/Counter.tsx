import { useState, useId } from 'yielderact';

export function* Counter() {
  const decrementId = yield* useId();
  const valueId = yield* useId();
  const incrementId = yield* useId();
  const resetId = yield* useId();

  const [count, setCount] = yield* useState(0);

  return (
    <section aria-label="Counter example">
      <h2>Counter</h2>
      <p>
        A generator component keeps state via <code>yield* useState</code>. Each call to the setter
        re-runs the component body and reconciles the DOM.
      </p>
      <div className="flex gap-2 items-center">
        <button id={decrementId} data-testid="decrement-btn" onClick={() => setCount(count - 1)}>
          −
        </button>
        <span id={valueId} data-testid="counter-value">
          {count}
        </span>
        <button id={incrementId} data-testid="increment-btn" onClick={() => setCount(count + 1)}>
          +
        </button>
        <button id={resetId} data-testid="reset-btn" onClick={() => setCount(0)} className="ml-2">
          Reset
        </button>
      </div>
    </section>
  );
}
