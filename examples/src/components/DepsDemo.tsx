/**
 * DepsDemo – demonstrates the `$deps` prop, which replaces the default
 * shallow-equal props check with a dependency-array comparison.
 *
 * Covers:
 * - Component with $deps (skip rerender)
 * - Element with $deps (skip entire subtree)
 * - Nested elements with $deps
 * - Component with component children
 * - Component with element children
 */
import { useRef, useState } from "yract";

// ---------------------------------------------------------------------------
// Child: tracks how many times it actually renders
// ---------------------------------------------------------------------------

function* RenderCounter({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  data?: Record<string, number>;
  children?: unknown;
}) {
  const countRef = yield* useRef(0);
  countRef.current++;

  return (
    <div
      data-testid={`deps-${label}`}
      style={{
        padding: "0.5rem 0.75rem",
        background: "#f8f9fa",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        marginBottom: "0.5rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <strong>{label}:</strong>
        <span>
          value=<span data-testid={`deps-${label}-value`}>{value}</span>
        </span>
        <span style={{ color: "#666" }}>
          (renders: <span data-testid={`deps-${label}-renders`}>{countRef.current}</span>)
        </span>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny child component used as a nested render-counter
// ---------------------------------------------------------------------------

function* ChildCounter({ label }: { label: string }) {
  const countRef = yield* useRef(0);
  countRef.current++;
  return (
    <span data-testid={`deps-${label}`} style={{ color: "#666", fontSize: "0.85rem" }}>
      child renders: <span data-testid={`deps-${label}-renders`}>{countRef.current}</span>
    </span>
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
        dependency-array comparison. Click "Increment irrelevant" to see which subtrees skip
        updates.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button data-testid="deps-inc-relevant" onClick={() => setRelevant((v) => v + 1)}>
          Increment relevant ({relevant})
        </button>
        <button data-testid="deps-inc-irrelevant" onClick={() => setIrrelevant((v) => v + 1)}>
          Increment irrelevant ({irrelevant})
        </button>
      </div>

      {/* 1. Component with $deps */}
      <h3>Component with $deps</h3>
      <RenderCounter
        label="with-deps"
        value={relevant}
        data={{ relevant, irrelevant }}
        $deps={[relevant]}
      />

      {/* 2. Component without $deps (baseline) */}
      <h3>Component without $deps</h3>
      <RenderCounter label="without-deps" value={relevant} data={{ relevant, irrelevant }} />

      {/* 3. Element with $deps — entire subtree frozen */}
      <h3>Element with $deps</h3>
      <div
        data-testid="deps-element"
        $deps={[relevant]}
        style={{
          padding: "0.5rem",
          background: "#f0f0f0",
          borderRadius: "6px",
          marginBottom: "0.5rem",
        }}
      >
        <span data-testid="deps-element-text">
          relevant={relevant} irrelevant={irrelevant}
        </span>
      </div>

      {/* 4. Nested elements with $deps on outer */}
      <h3>Nested elements with $deps</h3>
      <div
        data-testid="deps-nested-outer"
        $deps={[relevant]}
        style={{
          padding: "0.5rem",
          background: "#e8f4e8",
          borderRadius: "6px",
          marginBottom: "0.5rem",
        }}
      >
        <div data-testid="deps-nested-inner">
          <span data-testid="deps-nested-text">
            relevant={relevant} irrelevant={irrelevant}
          </span>
        </div>
      </div>

      {/* 5. Component with $deps that has component children */}
      <h3>Component with component children</h3>
      <RenderCounter
        label="comp-with-comp-children"
        value={relevant}
        data={{ relevant, irrelevant }}
        $deps={[relevant]}
      >
        <ChildCounter label="nested-comp-child" />
      </RenderCounter>

      {/* 6. Component with $deps that has element children */}
      <h3>Component with element children</h3>
      <RenderCounter
        label="comp-with-elem-children"
        value={relevant}
        data={{ relevant, irrelevant }}
        $deps={[relevant]}
      >
        <span data-testid="deps-nested-elem-child">irrelevant={irrelevant}</span>
      </RenderCounter>
    </section>
  );
}
