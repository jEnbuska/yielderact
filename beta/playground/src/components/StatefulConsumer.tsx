import { $context, $state } from "yract-beta";
import { ThemeCtx } from "./ContextDemo.shared";

export function* StatefulConsumer() {
  const theme = yield* $context(ThemeCtx);
  const [count, setCount] = yield* $state(0);
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
