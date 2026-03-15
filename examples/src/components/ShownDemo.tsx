/**
 * ShownDemo – demonstrates the `$shown` prop, which conditionally mounts and
 * unmounts elements and components without any conditional-expression syntax.
 *
 * Two scenarios are shown:
 *  1. HTML element  – a <div> panel toggled via `$shown`.
 *  2. Component – a stateful counter toggled via `$shown`; the
 *     counter resets to zero each time it is re-mounted.
 */
import { useState } from "yielderact";

// ---------------------------------------------------------------------------
// Sub-components used in the demo
// ---------------------------------------------------------------------------

function* StatefulCounter() {
  const [count, setCount] = yield* useState(0);

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
  const [showElement, setShowElement] = yield* useState(true);
  const [showGenerator, setShowGenerator] = yield* useState(true);

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

      {/* ── Row 2: component ── */}
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
          Show component
        </label>
        <StatefulCounter $shown={showGenerator} />
      </div>
    </section>
  );
}
