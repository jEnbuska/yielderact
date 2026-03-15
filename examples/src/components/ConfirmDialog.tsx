/**
 * ConfirmDialog – demonstrates the useRender / useResume hooks.
 *
 * Two variants are shown side-by-side:
 *  • Variant 1: JSX passed directly to useRender; the child uses useResume.
 *  • Variant 2: Inline render function receives resume as a prop.
 */
import { useRef, useRender, useResume, useState } from "yielderact";

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
    </div>
  );
}
