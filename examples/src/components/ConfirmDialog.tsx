/**
 * ConfirmDialog – demonstrates the useRender / useResume hooks.
 *
 * Two variants are shown side-by-side:
 *  • Variant 1: JSX passed directly to useRender; the child uses useResume.
 *  • Variant 2: Inline render function receives resume as a prop.
 */
import { useRef, useRender, useResume, useState } from "yract";

// ---------------------------------------------------------------------------
// Variant 1 – child component uses useResume
// ---------------------------------------------------------------------------

type Answer = "ACCEPTED" | "REJECTED" | "NONE";

function* ProceedDialog({ acceptText, rejectText }: { acceptText: string; rejectText: string }) {
  const resume = yield* useResume<Answer>();
  return (
    <div data-testid="v1-dialog" style={{ display: "flex", gap: "0.5rem" }}>
      <button
        data-testid="v1-accept"
        onClick={() => resume("ACCEPTED")}
        style={{
          padding: "0.4rem 1rem",
          background: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        {acceptText}
      </button>
      <button
        data-testid="v1-reject"
        onClick={() => resume("REJECTED")}
        style={{
          padding: "0.4rem 1rem",
          background: "#e00",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        {rejectText}
      </button>
    </div>
  );
}

function* Variant1() {
  const answer = yield* useRef<Answer>("NONE");
  const [, rerender] = yield* useState(0);

  while (answer.current === "NONE") {
    answer.current = yield* useRender<Answer>(
      <ProceedDialog acceptText="Accept" rejectText="Reject" />,
    );
  }

  return (
    <p data-testid="v1-result">
      Variant 1 result: <strong data-testid="v1-answer">{answer.current}</strong>{" "}
      <button
        data-testid="v1-reset"
        onClick={() => {
          answer.current = "NONE";
          rerender((n) => n + 1);
        }}
        style={{ marginLeft: "0.5rem", cursor: "pointer" }}
      >
        Reset
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Variant 2 – inline render function
// ---------------------------------------------------------------------------

function* Variant2() {
  const answer = yield* useRef<Answer>("NONE");
  const [, rerender] = yield* useState(0);

  while (answer.current === "NONE") {
    answer.current = yield* useRender<Answer>(
      ({ resume }) => (
        <div data-testid="v2-dialog" style={{ display: "flex", gap: "0.5rem" }}>
          <button
            data-testid="v2-accept"
            onClick={() => resume("ACCEPTED")}
            style={{
              padding: "0.4rem 1rem",
              background: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Accept (inline)
          </button>
          <button
            data-testid="v2-reject"
            onClick={() => resume("REJECTED")}
            style={{
              padding: "0.4rem 1rem",
              background: "#e00",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reject (inline)
          </button>
        </div>
      ),
      [],
    );
  }

  return (
    <p data-testid="v2-result">
      Variant 2 result: <strong data-testid="v2-answer">{answer.current}</strong>{" "}
      <button
        data-testid="v2-reset"
        onClick={() => {
          answer.current = "NONE";
          rerender((n) => n + 1);
        }}
        style={{ marginLeft: "0.5rem", cursor: "pointer" }}
      >
        Reset
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Variant 3 – wizard: multiple sequential useRender calls (useResume)
// ---------------------------------------------------------------------------

function* NameStep() {
  const resume = yield* useResume<string>();
  const [name, setName] = yield* useState("");
  return (
    <div data-testid="v3-step-name" style={{ display: "flex", gap: "0.5rem" }}>
      <input
        data-testid="v3-name-input"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        placeholder="Enter your name"
        style={{ padding: "0.4rem" }}
      />
      <button
        data-testid="v3-name-next"
        onClick={() => resume(name)}
        style={{
          padding: "0.4rem 1rem",
          background: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Next
      </button>
    </div>
  );
}

function* ColorStep() {
  const resume = yield* useResume<string>();
  return (
    <div data-testid="v3-step-color" style={{ display: "flex", gap: "0.5rem" }}>
      {["Red", "Green", "Blue"].map((color) => (
        <button
          key={color}
          data-testid={`v3-color-${color.toLowerCase()}`}
          onClick={() => resume(color)}
          style={{
            padding: "0.4rem 1rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {color}
        </button>
      ))}
    </div>
  );
}

function* Variant3() {
  const result = yield* useRef<{ name: string; color: string } | null>(null);
  const [, rerender] = yield* useState(0);

  while (result.current === null) {
    const name = yield* useRender<string>(<NameStep />);
    const color = yield* useRender<string>(<ColorStep />);
    result.current = { name, color };
  }

  return (
    <p data-testid="v3-result">
      Wizard result: <strong data-testid="v3-answer">{result.current.name}</strong> chose{" "}
      <strong data-testid="v3-color">{result.current.color}</strong>{" "}
      <button
        data-testid="v3-reset"
        onClick={() => {
          result.current = null;
          rerender((n) => n + 1);
        }}
        style={{ marginLeft: "0.5rem", cursor: "pointer" }}
      >
        Reset
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Variant 4 – wizard: multiple sequential useRender calls (inline)
// ---------------------------------------------------------------------------

function* Variant4() {
  const result = yield* useRef<{ a: number; b: number } | null>(null);
  const [, rerender] = yield* useState(0);

  while (result.current === null) {
    const a = yield* useRender<number>(
      ({ resume }) => (
        <div data-testid="v4-step-a" style={{ display: "flex", gap: "0.5rem" }}>
          {[1, 2, 3].map((n) => (
            <button
              key={String(n)}
              data-testid={`v4-a-${n}`}
              onClick={() => resume(n)}
              style={{
                padding: "0.4rem 1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      ),
      [],
    );
    const b = yield* useRender<number>(
      ({ resume }) => (
        <div data-testid="v4-step-b" style={{ display: "flex", gap: "0.5rem" }}>
          {[10, 20, 30].map((n) => (
            <button
              key={String(n)}
              data-testid={`v4-b-${n}`}
              onClick={() => resume(n)}
              style={{
                padding: "0.4rem 1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      ),
      [],
    );
    result.current = { a, b };
  }

  return (
    <p data-testid="v4-result">
      Result: <strong data-testid="v4-answer">{result.current.a + result.current.b}</strong> (
      {result.current.a} + {result.current.b}){" "}
      <button
        data-testid="v4-reset"
        onClick={() => {
          result.current = null;
          rerender((n) => n + 1);
        }}
        style={{ marginLeft: "0.5rem", cursor: "pointer" }}
      >
        Reset
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Variant 5 – parent state reflected in useRender dialog
// ---------------------------------------------------------------------------

function* QuantityDialog({
  quantity,
  setQuantity,
}: {
  quantity: number;
  setQuantity: (fn: (prev: number) => number) => void;
}) {
  const resume = yield* useResume<number>();
  return (
    <div data-testid="v5-dialog" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <button
        data-testid="v5-decrement"
        onClick={() => setQuantity((n) => Math.max(0, n - 1))}
        style={{
          padding: "0.4rem 0.8rem",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        −
      </button>
      <span data-testid="v5-quantity" style={{ minWidth: "2rem", textAlign: "center" }}>
        {quantity}
      </span>
      <button
        data-testid="v5-increment"
        onClick={() => setQuantity((n) => n + 1)}
        style={{
          padding: "0.4rem 0.8rem",
          border: "1px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        +
      </button>
      <button
        data-testid="v5-confirm"
        onClick={() => resume(quantity)}
        style={{
          padding: "0.4rem 1rem",
          marginLeft: "0.5rem",
          background: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Confirm
      </button>
    </div>
  );
}

function* Variant5() {
  const [quantity, setQuantity] = yield* useState(1);
  const confirmed = yield* useRender<number>(
    <QuantityDialog quantity={quantity} setQuantity={setQuantity} />,
  );
  return (
    <p data-testid="v5-result">
      Confirmed quantity: <strong data-testid="v5-answer">{confirmed}</strong>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Top-level export
// ---------------------------------------------------------------------------

export function* ConfirmDialog() {
  return (
    <div>
      <h2>useRender / useResume</h2>
      <p style={{ color: "#555", marginBottom: "1rem" }}>
        Components can pause and wait for user interaction using <code>useRender</code>. The resume
        callback unblocks the generator and returns the value to the caller.
      </p>

      <h3>
        Variant 1 – child uses <code>useResume</code>
      </h3>
      <Variant1 />

      <h3>Variant 2 – inline render function</h3>
      <Variant2 />

      <h3>Variant 3 – wizard (multiple useRender with useResume)</h3>
      <Variant3 />

      <h3>Variant 4 – wizard (multiple useRender inline)</h3>
      <Variant4 />

      <h3>Variant 5 – parent state reflected in dialog</h3>
      <Variant5 />
    </div>
  );
}
