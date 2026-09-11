/**
 * KeyShuffleDemo – demonstrates keyed reconciliation.
 *
 * Shows that reordering keyed children moves DOM nodes instead of
 * recreating them, and that component state is preserved
 * across reorders.
 */
import { useEffect, useRef, useState } from "yract";
import { Window, WindowBar, WindowBody } from "../../dos";

/* ── Stateful counter item ── */

function* CounterItem({ id, color }: { id: string; color: string }) {
  const [count, setCount] = yield* useState(0);
  const renders = yield* useRef(1);
  yield* useEffect(() => {
    renders.current++;
  }, [renders.current]);

  return (
    <div
      data-testid={`item-${id}`}
      data-id={id}
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        padding: "0.4rem 0.75rem",
        marginBottom: "0.35rem",
        borderRadius: "4px",
        border: `2px solid ${color}`,
        background: "#fafafa",
        justifyContent: "space-around",
      }}
    >
      <strong style={{ minWidth: "1.5rem" }}>{id}</strong>
      <span data-testid={`count-${id}`}>{count}</span>
      <button data-testid={`inc-${id}`} onClick={() => setCount(count + 1)}>
        +
      </button>
      <div>Renders: {renders.current}</div>
    </div>
  );
}

/* ── Tag item ── */

function* PlainTag({ label }: { label: string }) {
  return (
    <span
      data-testid={`tag-${label}`}
      style={{
        display: "inline-block",
        padding: "0.25rem 0.6rem",
        marginRight: "0.35rem",
        marginBottom: "0.35rem",
        borderRadius: "12px",
        background: label,
        color: "white",
        fontSize: "0.85rem",
      }}
    >
      {label}
    </span>
  );
}

/* ── Helpers ── */

const COLORS: Record<string, string> = {
  A: "#e74c3c",
  B: "#2ecc71",
  C: "#3498db",
  D: "#f39c12",
  E: "#9b59b6",
};

const ALL_IDS = ["A", "B", "C", "D", "E"];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ── Main demo ── */

export function* KeyShuffleDemo() {
  const [order, setOrder] = yield* useState(["A", "B", "C"]);
  const [tagOrder, setTagOrder] = yield* useState(["red", "green", "blue"]);
  const [elemOrder, setElemOrder] = yield* useState(["first", "second", "third"]);

  return (
    <Window>
      <WindowBar title="Key Shuffle" aside="/key-shuffle" />
      <WindowBody>
        <p>
          Keyed reconciliation moves DOM nodes instead of recreating them. Component state (counters
          below) is preserved across reorders.
        </p>

        {/* ── Stateful component list ── */}
        <h3>Components (stateful)</h3>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <button data-testid="shuffle-btn" onClick={() => setOrder(shuffle(order))}>
            Shuffle
          </button>
          <button data-testid="reverse-btn" onClick={() => setOrder([...order].reverse())}>
            Reverse
          </button>
          <button
            data-testid="add-btn"
            onClick={() => {
              const next = ALL_IDS.find((id) => !order.includes(id));
              if (next) setOrder([...order, next]);
            }}
          >
            Add
          </button>
          <button
            data-testid="remove-last-btn"
            onClick={() => {
              if (order.length > 0) setOrder(order.slice(0, -1));
            }}
          >
            Remove last
          </button>
        </div>
        <div data-testid="generator-list">
          <CounterItem id={""} color={"blue"} />
          {order.map((id) => (
            <CounterItem key={id} id={id} color={COLORS[id] ?? "#999"} />
          ))}
          <CounterItem id={""} color={"green"} />
        </div>
        <p data-testid="generator-order" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
          Order: {order.join(", ")}
        </p>

        {/* ── Tag component list ── */}
        <h3>Tag components</h3>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <button
            data-testid="tag-reverse-btn"
            onClick={() => setTagOrder([...tagOrder].reverse())}
          >
            Reverse tags
          </button>
        </div>
        <div data-testid="tag-list">
          {tagOrder.map((label) => (
            <PlainTag key={label} label={label} />
          ))}
        </div>
        <p data-testid="tag-order" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
          Order: {tagOrder.join(", ")}
        </p>

        {/* ── Keyed HTML elements ── */}
        <h3>Keyed HTML elements</h3>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <button
            data-testid="elem-reverse-btn"
            onClick={() => setElemOrder([...elemOrder].reverse())}
          >
            Reverse elements
          </button>
        </div>
        <ul data-testid="elem-list">
          {elemOrder.map((text) => (
            <li key={text} data-testid={`elem-${text}`}>
              {text}
            </li>
          ))}
        </ul>
        <p data-testid="elem-order" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
          Order: {elemOrder.join(", ")}
        </p>
      </WindowBody>
    </Window>
  );
}
