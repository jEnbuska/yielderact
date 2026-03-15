/**
 * ChildrenOptDemo — demonstrates the children-only reconciliation optimization.
 *
 * When a parent rerenders but a child wrapper's own props haven't changed,
 * the wrapper's generator is skipped and only the passed children are
 * reconciled. Render counters show the optimization in action.
 */
import type { Child } from "yract";
import { useRef, useState } from "yract";

/** A wrapper that passes children through. Tracks its own render count via ref. */
function* Wrapper({ label, children }: { label: string; children?: Child | Child[] }) {
  const countRef = yield* useRef(0);
  countRef.current++;

  return (
    <div
      data-testid={`wrapper-${label}`}
      style={{
        border: "1px solid #ccc",
        borderRadius: "6px",
        padding: "0.75rem",
        marginBottom: "0.75rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <strong>{label}</strong>
        <span data-testid={`render-count-${label}`} style={{ color: "#888", fontSize: "0.85rem" }}>
          renders: {countRef.current}
        </span>
      </div>
      <div data-testid={`content-${label}`}>{children}</div>
    </div>
  );
}

/** A child component that also tracks renders via ref. */
function* RenderChild({ value }: { value: number }) {
  const countRef = yield* useRef(0);
  countRef.current++;

  return (
    <span data-testid="child-value">
      value={value} (child renders: <span data-testid="child-render-count">{countRef.current}</span>
      )
    </span>
  );
}

export function* ChildrenOptDemo() {
  const [count, setCount] = yield* useState(0);

  return (
    <div data-testid="children-opt-demo">
      <h2>Children Optimization</h2>
      <p style={{ color: "#555", marginBottom: "1rem" }}>
        Click the button to increment the counter. The &ldquo;Optimized&rdquo; wrapper&apos;s render
        count stays at 1 because only its children change &mdash; the generator is skipped.
      </p>

      <button
        data-testid="increment-btn"
        onClick={() => setCount((c: number) => c + 1)}
        style={{ padding: "0.4rem 0.9rem", marginBottom: "1rem" }}
      >
        Count: {count}
      </button>

      <Wrapper label="optimized">
        <RenderChild value={count} />
      </Wrapper>

      <Wrapper label="with-prop" $shown={count >= 0}>
        <span data-testid="static-child">This wrapper always has the same children</span>
      </Wrapper>
    </div>
  );
}
