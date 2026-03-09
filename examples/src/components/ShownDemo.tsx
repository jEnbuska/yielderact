/**
 * ShownDemo – demonstrates the `$shown` prop, which conditionally mounts and
 * unmounts elements and components without any conditional-expression syntax.
 *
 * Three scenarios are shown:
 *  1. HTML element  – a <div> panel toggled via `$shown`.
 *  2. Function component – a stateless component toggled via `$shown`.
 *  3. Generator component – a stateful counter toggled via `$shown`; the
 *     counter resets to zero each time it is re-mounted.
 */
import { $state } from "yielderact";

// ---------------------------------------------------------------------------
// Sub-components used in the demo
// ---------------------------------------------------------------------------

function InfoPanel() {
  return (
    <div
      data-testid="info-panel"
      style={{
        padding: "0.75rem 1rem",
        background: "#f0f4ff",
        border: "1px solid #c0cff8",
        borderRadius: "6px",
      }}
    >
      I am a <strong>function component</strong> – I mount and unmount based on the{" "}
      <code>$shown</code> prop.
    </div>
  );
}

function* StatefulCounter() {
  const [count, setCount] = yield* $state(0);

  return (
    <div
      data-testid="stateful-counter"
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        padding: "0.75rem 1rem",
        background: "#f0fff4",
        border: "1px solid #b0e8c0",
        borderRadius: "6px",
      }}
    >
      <strong>Stateful counter (resets on re-mount):</strong>
      <button data-testid="counter-dec" onClick={() => setCount(count - 1)}>
        −
      </button>
      <span data-testid="counter-val">{count}</span>
      <button data-testid="counter-inc" onClick={() => setCount(count + 1)}>
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main demo component
// ---------------------------------------------------------------------------

export function* ShownDemo() {
  const [showElement, setShowElement] = yield* $state(true);
  const [showFunction, setShowFunction] = yield* $state(true);
  const [showGenerator, setShowGenerator] = yield* $state(true);

  return (
    <section aria-label="shown prop demo">
      <h2>
        <code>$shown</code> Prop
      </h2>
      <p>
        The <code>$shown</code> prop lets you conditionally mount and unmount any element or
        component. When <code>$shown</code> changes to <code>false</code> the node is fully removed
        from the DOM (and its state is discarded); setting it back to <code>true</code> re-mounts a
        fresh instance.
      </p>

      {/* ── Row 1: HTML element ── */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}
        >
          <input
            type="checkbox"
            data-testid="toggle-element"
            checked={showElement}
            onChange={() => setShowElement(!showElement)}
          />
          Show HTML element
        </label>
        <div
          $shown={showElement}
          data-testid="shown-element"
          style={{
            padding: "0.75rem 1rem",
            background: "#fff8e1",
            border: "1px solid #ffe082",
            borderRadius: "6px",
          }}
        >
          I am a plain <strong>&lt;div&gt;</strong> element — toggled with the <code>$shown</code>{" "}
          prop.
        </div>
      </div>

      {/* ── Row 2: function component ── */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}
        >
          <input
            type="checkbox"
            data-testid="toggle-function"
            checked={showFunction}
            onChange={() => setShowFunction(!showFunction)}
          />
          Show function component
        </label>
        <InfoPanel $shown={showFunction} />
      </div>

      {/* ── Row 3: generator component ── */}
      <div>
        <label
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}
        >
          <input
            type="checkbox"
            data-testid="toggle-generator"
            checked={showGenerator}
            onChange={() => setShowGenerator(!showGenerator)}
          />
          Show generator component
        </label>
        <StatefulCounter $shown={showGenerator} />
      </div>
    </section>
  );
}
