/**
 * DepsDemo – demonstrates the `$deps` prop, which replaces the default
 * shallow-equal props check with a dependency-array comparison.
 *
 * The parent passes new object references on every render, but the child
 * component only rerenders when its `$deps` change. A render counter
 * makes the skip behaviour visible.
 */
import { useRef, useState } from "yract";

// ---------------------------------------------------------------------------
// Child: tracks how many times it actually renders
// ---------------------------------------------------------------------------

function* RenderCounter({
  label,
  value,
}: {
  label: string;
  value: number;
  data?: Record<string, number>;
}) {
  const countRef = yield* useRef(0);
  countRef.current++;

  return (
    <div
      data-testid={`deps-${label}`}
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        padding: "0.5rem 0.75rem",
        background: "#f8f9fa",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        marginBottom: "0.5rem",
      }}
    >
      <strong>{label}:</strong>
      <span>
        value=<span data-testid={`deps-${label}-value`}>{value}</span>
      </span>
      <span style={{ color: "#666" }}>
        (renders: <span data-testid={`deps-${label}-renders`}>{countRef.current}</span>)
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------

export function* DepsDemo() {
  const [relevant, setRelevant] = yield* useState(0);
  const [irrelevant, setIrrelevant] = yield* useState(0);

  return (
    <section aria-label="deps prop demo">
      <h2>
        <code>$deps</code> Prop
      </h2>
      <p>
        The <code>$deps</code> prop replaces the default shallow-equal props check with a
        dependency-array comparison. The component below only rerenders when <code>$deps</code>{" "}
        changes — even though new object references are passed on every parent render.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button data-testid="deps-inc-relevant" onClick={() => setRelevant((v) => v + 1)}>
          Increment relevant ({relevant})
        </button>
        <button data-testid="deps-inc-irrelevant" onClick={() => setIrrelevant((v) => v + 1)}>
          Increment irrelevant ({irrelevant})
        </button>
      </div>

      <h3>With $deps (only rerenders when relevant changes)</h3>
      <RenderCounter
        label="with-deps"
        value={relevant}
        data={{ relevant, irrelevant }}
        $deps={[relevant]}
      />

      <h3>Without $deps (rerenders on every parent render)</h3>
      <RenderCounter label="without-deps" value={relevant} data={{ relevant, irrelevant }} />

      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Click "Increment irrelevant" — the component <strong>with</strong> <code>$deps</code> stays
        at the same render count, while the one <strong>without</strong> rerenders every time.
      </p>
    </section>
  );
}
