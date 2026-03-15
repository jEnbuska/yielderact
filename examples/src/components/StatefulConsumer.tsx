import { useContext, useState } from "yielderact";
import { ThemeCtx } from "./ContextDemo.shared";

export function* StatefulConsumer() {
  const theme = yield* useContext(ThemeCtx);
  const [count, setCount] = yield* useState(0);
  return (
    <div data-testid="stateful-consumer" style={{ display: "flex", gap: "0.5rem" }}>
      <span data-testid="stateful-theme">{theme}</span>
      <span data-testid="stateful-count">{count}</span>
      <button data-testid="stateful-inc" onClick={() => setCount((c) => c + 1)}>
        +1
      </button>
    </div>
  );
}
