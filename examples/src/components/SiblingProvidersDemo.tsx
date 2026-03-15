import { useContext, useState } from "yielderact";
import { type Theme, ThemeCtx, themeStyles } from "./ContextDemo.shared";

function* SiblingConsumerA() {
  const theme = yield* useContext(ThemeCtx);
  return (
    <span data-testid="sibling-a" style={{ ...themeStyles[theme] }}>
      {theme}
    </span>
  );
}

function* SiblingConsumerB() {
  const theme = yield* useContext(ThemeCtx);
  return (
    <span data-testid="sibling-b" style={{ ...themeStyles[theme] }}>
      {theme}
    </span>
  );
}

export function* SiblingProvidersDemo() {
  const [valA, setValA] = yield* useState<Theme>("light");
  const [valB, setValB] = yield* useState<Theme>("dark");

  return (
    <div>
      <h3>4 - Sibling providers are isolated</h3>
      <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
        Two sibling subtrees provide different values for the same context. They must not interfere.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <button
          data-testid="toggle-sibling-a"
          onClick={() => setValA((v) => (v === "light" ? "dark" : "light"))}
        >
          Toggle A (currently: {valA})
        </button>
        <button
          data-testid="toggle-sibling-b"
          onClick={() => setValB((v) => (v === "light" ? "dark" : "light"))}
        >
          Toggle B (currently: {valB})
        </button>
      </div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <ThemeCtx.Provider value={valA}>
          <div
            data-testid="sibling-panel-a"
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          >
            Subtree A: <SiblingConsumerA />
          </div>
        </ThemeCtx.Provider>
        <ThemeCtx.Provider value={valB}>
          <div
            data-testid="sibling-panel-b"
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          >
            Subtree B: <SiblingConsumerB />
          </div>
        </ThemeCtx.Provider>
      </div>
    </div>
  );
}
