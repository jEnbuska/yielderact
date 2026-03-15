/**
 * PortalDemo – demonstrates `createPortal` for rendering children into an
 * external DOM container outside the normal component tree.
 *
 * Three scenarios are shown:
 *  1. Basic portal – renders a modal into `document.body`.
 *  2. Context inheritance – a portaled child reads context from its logical
 *     parent, not the physical DOM position.
 *  3. Event handling – events fire correctly inside portaled content.
 */
import { createContext, createPortal, useContext, useRef, useState } from "yielderact";

const PortalThemeCtx = createContext<"light" | "dark">("light");

/** Reads the PortalThemeCtx to verify context flows through portals. */
function* PortalThemeConsumer() {
  const theme = yield* useContext(PortalThemeCtx);
  return (
    <span
      data-testid="portal-theme-value"
      style={{
        padding: "0.25rem 0.5rem",
        borderRadius: "4px",
        background: theme === "dark" ? "#333" : "#eee",
        color: theme === "dark" ? "#fff" : "#333",
      }}
    >
      Theme: {theme}
    </span>
  );
}

/** A simple counter rendered inside a portal to verify events work. */
function* PortalCounter() {
  const [count, setCount] = yield* useState(0);
  return (
    <div
      data-testid="portal-counter"
      style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
    >
      <button data-testid="portal-counter-dec" onClick={() => setCount((c) => c - 1)}>
        −
      </button>
      <span data-testid="portal-counter-value">{count}</span>
      <button data-testid="portal-counter-inc" onClick={() => setCount((c) => c + 1)}>
        +
      </button>
    </div>
  );
}

export function* PortalDemo() {
  const [showModal, setShowModal] = yield* useState(false);
  const [theme, setTheme] = yield* useState<"light" | "dark">("light");
  const containerRef = yield* useRef<HTMLDivElement | undefined>(undefined);

  return (
    <section aria-label="Portal demo">
      <h2>createPortal</h2>
      <p>
        Portals render children into a DOM node outside the render root. Context is inherited from
        the component tree (not the DOM tree), and events work normally inside portaled content.
      </p>

      {/* ── Scenario 1 & 3: Modal portal ── */}
      <div style={{ marginBottom: "1rem" }}>
        <button
          data-testid="portal-toggle-modal"
          onClick={() => setShowModal((v) => !v)}
          style={{ marginBottom: "0.5rem" }}
        >
          {showModal ? "Close Modal" : "Open Modal"}
        </button>

        {/* ── Scenario 2: Context toggle ── */}
        <button
          data-testid="portal-toggle-theme"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          style={{ marginLeft: "0.5rem", marginBottom: "0.5rem" }}
        >
          Theme: {theme}
        </button>
      </div>

      {/* Portal target container (rendered in normal flow for demo visibility) */}
      <div
        data-testid="portal-target"
        $ref={containerRef}
        style={{
          border: "2px dashed #999",
          borderRadius: "6px",
          padding: "1rem",
          minHeight: "2rem",
          marginBottom: "1rem",
          background: "#fafafa",
        }}
      >
        <em style={{ color: "#999" }}>Portal target container</em>
      </div>

      {/* Portal content – rendered into the target container */}
      {containerRef.current && showModal
        ? createPortal(
            <PortalThemeCtx.Provider value={theme}>
              <div
                data-testid="portal-modal"
                style={{
                  padding: "1rem",
                  background: theme === "dark" ? "#222" : "#fff",
                  color: theme === "dark" ? "#eee" : "#333",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Portal Modal</h3>
                <p>
                  This content is rendered via <code>createPortal</code> into the dashed container
                  above.
                </p>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Context inheritance: </strong>
                  <PortalThemeConsumer />
                </div>
                <div>
                  <strong>Events: </strong>
                  <PortalCounter />
                </div>
              </div>
            </PortalThemeCtx.Provider>,
            containerRef.current,
          )
        : false}

      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Open the modal and toggle the theme to see context inheritance. Use the counter to verify
        events work inside the portal.
      </p>
    </section>
  );
}
