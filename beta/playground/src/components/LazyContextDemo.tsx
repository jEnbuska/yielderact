/**
 * LazyContextDemo -- demonstrates all three $context overloads:
 *
 *   1. No selector   -- rerenders whenever the Provider value changes.
 *   2. Selector only -- rerenders only when the selected deps change; returns full value.
 *   3. Selector + transform -- same rerender guard; returns the transformed value.
 */
import { $state } from "yract-beta";
import { AppCtx, type AppState } from "./LazyContextDemo.shared";
import { NoSelectorConsumer } from "./NoSelectorConsumer";
import { SelectorConsumer } from "./SelectorConsumer";
import { TransformConsumer } from "./TransformConsumer";

export function* LazyContextDemo() {
  const [state, setState] = yield* $state<AppState>({
    user: { name: "Alice", role: "admin" },
    count: 0,
  });

  return (
    <section aria-label="Lazy context demo" data-testid="lazy-ctx-demo">
      <h2>Lazy $context (selector &amp; transform)</h2>
      <p style={{ fontSize: "0.875rem", color: "#555", marginBottom: "0.75rem" }}>
        The <strong>render count badge</strong> on each consumer shows how many times it has
        rendered. Use the buttons to change only <code>count</code> or only <code>user.name</code>{" "}
        and observe which consumers rerender.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          data-testid="lazy-ctx-bump-count"
          onClick={() =>
            setState({
              ...state,
              count: state.count + 1,
            })
          }
          style={{ padding: "0.4rem 0.8rem" }}
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
                name: state.user.name === "Alice" ? "Bob" : "Alice",
              },
            })
          }
          style={{ padding: "0.4rem 0.8rem" }}
        >
          Toggle name (Alice / Bob)
        </button>

        <button
          data-testid="lazy-ctx-change-role"
          onClick={() =>
            setState({
              ...state,
              user: {
                ...state.user,
                role: state.user.role === "admin" ? "viewer" : "admin",
              },
            })
          }
          style={{ padding: "0.4rem 0.8rem" }}
        >
          Toggle role (admin / viewer)
        </button>
      </div>

      <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.75rem" }}>
        Current state -- name: <strong>{state.user.name}</strong> | role:{" "}
        <strong>{state.user.role}</strong> | count: <strong>{state.count}</strong>
      </p>

      <AppCtx value={state}>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <NoSelectorConsumer />
          <SelectorConsumer />
          <TransformConsumer />
        </div>
      </AppCtx>

      <details style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#555" }}>
        <summary>Expected behavior</summary>
        <ul>
          <li>
            <strong>Bump count</strong> -- only overload 1 rerenders (selector consumers skip).
          </li>
          <li>
            <strong>Toggle role</strong> -- only overload 1 rerenders (selector consumers skip).
          </li>
          <li>
            <strong>Toggle name</strong> -- all three rerender (name is in each selector).
          </li>
        </ul>
      </details>
    </section>
  );
}
