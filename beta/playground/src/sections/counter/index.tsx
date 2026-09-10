/**
 * Counter – a component demonstrating stateful rendering with
 * `yield* useState` and returning JSX.
 */
import { useId, useState } from "yract-beta";
import { Window, WindowBar, WindowBody } from "../../dos";

export function* Counter() {
  const decrementId = yield* useId();
  const valueId = yield* useId();
  const incrementId = yield* useId();
  const resetId = yield* useId();

  const [count, setCount] = yield* useState(0);

  return (
    <Window>
      <WindowBar title="Counter" aside="/counter" />
      <WindowBody>
        <p>
          A component keeps state via <code>yield* useState</code>. Each call to the setter re-runs
          the component body and reconciles the DOM.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button id={decrementId} data-testid="decrement-btn" onClick={() => setCount(count - 1)}>
            −
          </button>
          <span id={valueId} data-testid="counter-value">
            {count}
          </span>
          <button id={incrementId} data-testid="increment-btn" onClick={() => setCount(count + 1)}>
            +
          </button>
          <button
            id={resetId}
            data-testid="reset-btn"
            onClick={() => setCount(0)}
            style={{ marginLeft: "0.5rem" }}
          >
            Reset
          </button>
        </div>
      </WindowBody>
    </Window>
  );
}
